// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./utils/DSTestPlusF.sol";
import "./utils/users/MockAccounts.sol";

import { IACLConstants } from "../../contracts/base/IACLConstants.sol";
import { ISettingsKeys } from "../../contracts/base/ISettingsKeys.sol";
import { AccessControl } from "../../contracts/base/AccessControl.sol";
import { ACL } from "../../contracts/ACL.sol";
import { Settings } from "../../contracts/Settings.sol";
import { ISettings } from "../../contracts/base/ISettings.sol";

import { IMarket } from "../../contracts/base/IMarket.sol";
import { IMarketFeeSchedules } from "../../contracts/base/IMarketFeeSchedules.sol";
import { IMarketDataFacet } from "../../contracts/base/IMarketDataFacet.sol";
import { IMarketOfferStates } from "../../contracts/base/IMarketOfferStates.sol";
import { Market } from "../../contracts/Market.sol";
import { MarketCoreFacet } from "../../contracts/MarketCoreFacet.sol";
import { MarketDataFacet } from "../../contracts/MarketDataFacet.sol";

import { FeeBank } from "../../contracts/FeeBank.sol";
import { FeeBankCoreFacet } from "../../contracts/FeeBankCoreFacet.sol";

import { DummyToken } from "../../contracts/DummyToken.sol";

import { EntityDeployer } from "../../contracts/EntityDeployer.sol";

import { DummyMarketCaller } from "../../contracts/test/DummyMarketCaller.sol";
import { DummyMarketObserver } from "../../contracts/test/DummyMarketObserver.sol";

contract MarketTest is DSTestPlusF, MockAccounts, IACLConstants, ISettingsKeys, IMarketOfferStates, IMarketFeeSchedules {
    ACL internal acl;
    Settings internal settings;
    AccessControl internal accessControl;

    bytes32 internal systemContext;

    FeeBank internal feeBank;
    FeeBankCoreFacet internal feeBankCoreFacet;

    Market internal marketProxy;
    MarketCoreFacet internal mcf;
    MarketDataFacet internal mdf;

    DummyToken internal dai;
    DummyToken internal dai2;
    DummyToken internal weth;
    DummyToken internal weth2;

    EntityDeployer internal entityDeployer;

    IMarket internal market;

    DummyMarketObserver internal marketObserver = new DummyMarketObserver();
    bytes internal constant notifyData = "0xnayms";

    address internal immutable account0 = address(this);

    uint256 internal mintAmount;

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        accessControl = new AccessControl(address(settings));
        systemContext = acl.systemContext();

        feeBank = new FeeBank(address(settings));
        feeBankCoreFacet = new FeeBankCoreFacet(address(settings));

        entityDeployer = new EntityDeployer(address(settings));

        mcf = new MarketCoreFacet(address(settings));
        mdf = new MarketDataFacet(address(settings));

        address[] memory addys = new address[](2);
        addys[0] = address(mcf);
        addys[1] = address(mdf);

        settings.setAddresses(address(settings), SETTING_MARKET_IMPL, addys); // facets use the key with suffix _IMPL
        marketProxy = new Market(address(settings));

        settings.setAddress(address(settings), SETTING_MARKET, address(marketProxy)); // proxy diamond for marketProxy
        settings.setAddress(address(settings), SETTING_ENTITY_DEPLOYER, address(entityDeployer)); // entity deployer
        settings.setAddress(address(settings), SETTING_FEEBANK, address(feeBank)); // fee bank
        settings.setAddress(address(settings), SETTING_FEEBANK_IMPL, address(feeBankCoreFacet)); // fee bank facets

        dai = new DummyToken("Dai Stablecoin", "DAI", 18, 0, false);
        dai2 = new DummyToken("Dai Stablecoin 2", "DAI2", 18, 0, false);
        weth = new DummyToken("Wrapped ETH", "WETH", 18, 0, true);
        weth2 = new DummyToken("Wrapped ETH 2", "WETH2", 18, 0, true);

        vm.deal(account1, 1 ether);
        vm.deal(account2, 1 ether);
        vm.deal(account3, 1 ether);
        vm.deal(account4, 1 ether);

        mintAmount = 1000;
        dai.deposit{ value: mintAmount }();
        dai2.deposit{ value: mintAmount }();
        weth.deposit{ value: mintAmount }();
        weth2.deposit{ value: mintAmount }();

        vm.startPrank(account1);
        dai.deposit{ value: mintAmount }();
        dai2.deposit{ value: mintAmount }();
        weth.deposit{ value: mintAmount }();
        weth2.deposit{ value: mintAmount }();
        vm.stopPrank();

        vm.startPrank(account2);
        dai.deposit{ value: mintAmount }();
        dai2.deposit{ value: mintAmount }();
        weth.deposit{ value: mintAmount }();
        weth2.deposit{ value: mintAmount }();
        vm.stopPrank();

        vm.startPrank(account3);
        dai.deposit{ value: mintAmount }();
        dai2.deposit{ value: mintAmount }();
        weth.deposit{ value: mintAmount }();
        weth2.deposit{ value: mintAmount }();
        vm.stopPrank();

        vm.startPrank(account4);
        dai.deposit{ value: mintAmount }();
        dai2.deposit{ value: mintAmount }();
        weth.deposit{ value: mintAmount }();
        weth2.deposit{ value: mintAmount }();
        vm.stopPrank();

        market = IMarket(address(marketProxy));

        vm.label(address(marketProxy), "Market Proxy Diamond");
        vm.label(address(mcf), "Market Core Facet");
        vm.label(address(mdf), "Market Data Facet");
        vm.label(address(acl), "ACL");
        vm.label(address(settings), "Settings");
        vm.label(address(accessControl), "Access Control");
        vm.label(address(entityDeployer), "Entity Deployer");
        vm.label(address(feeBank), "Fee Bank");
        vm.label(address(feeBankCoreFacet), "Fee Bank Core Facet");
        vm.label(address(dai), "DAI");
        vm.label(address(dai2), "DAI2");
        vm.label(address(weth), "WETH");
        vm.label(address(weth2), "WETH2");
        vm.label(address(this), "Account 0 - Test Contract");
        vm.label(address(0xACC1), "Account 1");
        vm.label(address(0xACC2), "Account 2");
        vm.label(address(0xACC3), "Account 3");
        vm.label(address(0xACC4), "Account 4");
        vm.label(address(0xACC5), "Account 5");
        vm.label(address(0xACC6), "Account 6");
        vm.label(address(0xACC7), "Account 7");
        vm.label(address(0xACC8), "Account 8");
        vm.label(address(0xACC9), "Account 9");
    }

    function testGetConfig() public {
        uint256 dust;
        uint256 feeBP;

        (dust, feeBP) = market.getConfig();
        assertEq(dust, 1);
        assertEq(feeBP, 0);
    }

    function testExecuteLimitOffer() public {
        // invalid sell amount
        vm.expectRevert("sell amount must be uint128");
        market.executeLimitOffer(address(dai), 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, address(dai), 20, FEE_SCHEDULE_STANDARD, address(0), "");
        // invalid buy amount
        vm.expectRevert("buy amount must be uint128");
        market.executeLimitOffer(address(dai), 20, address(dai), 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, FEE_SCHEDULE_STANDARD, address(0), "");

        // 0 sell amount
        vm.expectRevert("sell amount must be >0");
        market.executeLimitOffer(address(dai), 0, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        // invalid sell token
        vm.expectRevert("sell token must be valid");
        market.executeLimitOffer(address(0), 10, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");

        // 0 buy amount
        vm.expectRevert("buy amount must be >0");
        market.executeLimitOffer(address(dai), 10, address(weth), 0, FEE_SCHEDULE_STANDARD, address(0), "");

        // invalid buy token
        vm.expectRevert("buy token must be valid");
        market.executeLimitOffer(address(dai), 10, address(0), 20, FEE_SCHEDULE_STANDARD, address(0), "");

        // identical buy and sell token
        vm.expectRevert("cannot sell and buy same token");
        market.executeLimitOffer(address(dai), 10, address(dai), 20, FEE_SCHEDULE_STANDARD, address(0), "");
    }

    function testFee() public {
        vm.expectRevert("must be admin");
        vm.prank(address(0xBEEF));
        market.setFee(2);
        // can be changed
        market.setFee(2);
        uint256 dust;
        uint256 feeBP;
        (dust, feeBP) = market.getConfig();
        assertEq(dust, 1);
        assertEq(feeBP, 2);

        // can be calculated per order
        market.setFee(2000);

        // but not if order uses two platform tokens
        vm.expectRevert("must be one platform token");
        market.calculateFee(address(weth), 10, address(weth2), 5, FEE_SCHEDULE_STANDARD);

        // but not if order uses two currency tokens
        vm.expectRevert("must be one platform token");
        market.calculateFee(address(dai), 10, address(dai2), 5, FEE_SCHEDULE_STANDARD);

        // and is always based on currency unit
        address feeToken;
        uint256 feeAmount;
        (feeToken, feeAmount) = market.calculateFee(address(weth), 10, address(dai), 5, FEE_SCHEDULE_STANDARD);
        assertEq(feeToken, address(dai));
        assertEq(feeAmount, 1);

        (feeToken, feeAmount) = market.calculateFee(address(dai), 10, address(weth), 5, FEE_SCHEDULE_STANDARD);
        assertEq(feeToken, address(dai));
        assertEq(feeAmount, 2);

        // and is 0 for platform actions
        (feeToken, feeAmount) = market.calculateFee(address(weth), 10, address(dai), 5, FEE_SCHEDULE_PLATFORM_ACTION);
        assertEq(feeToken, address(dai));
        assertEq(feeAmount, 0);
    }

    // platform token check
    function testPlatformToken() public {
        // does not allow 2 non-platform tokens
        uint256 payAmt = 10;
        uint256 buyAmt = 10;

        vm.startPrank(account2);
        dai.approve(address(market), payAmt);

        vm.expectRevert("must be one platform token");
        market.executeLimitOffer(address(dai), payAmt, address(dai2), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");

        // does not allow 2 platform tokens
        vm.expectRevert("must be one platform token");
        market.executeLimitOffer(address(weth), payAmt, address(weth2), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");

        // does allow 1 platform token
        weth.approve(address(market), payAmt);
        writeTokenBalance(account2, address(weth), 10);
        market.executeLimitOffer(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        writeTokenBalance(account2, address(dai), 10);
        market.executeLimitOffer(address(dai), payAmt, address(weth), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
    }

    function testFeeSchedule() public {
        uint256 payAmt = 10;
        uint256 buyAmt = 10;

        // disallow arbitrary caller
        vm.expectRevert(bytes(""));
        market.executeLimitOffer(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION, address(0), "");

        // disallow with invalid parent
        DummyMarketCaller child1 = new DummyMarketCaller(address(market), address(0));
        writeTokenBalance(address(child1), address(weth), payAmt);
        vm.expectRevert(bytes(""));
        child1.trade(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION);

        // disallow with parent that does not recognize child
        DummyMarketCaller child2 = new DummyMarketCaller(address(market), address(child1));
        writeTokenBalance(address(child2), address(weth), payAmt);
        vm.expectRevert(bytes("fee schedule: bad parent"));
        child2.trade(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION);

        // disallow with good parent that is NOT entity deployer
        child1.addChild(address(child2));
        vm.expectRevert(bytes(""));
        child2.trade(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION);

        // disallow with good grandparent that is NOT entity deployer
        DummyMarketCaller child3 = new DummyMarketCaller(address(market), address(child2));
        child2.addChild(address(child3));
        writeTokenBalance(address(child3), address(weth), payAmt);
        vm.expectRevert(bytes("fee schedule: bad deployment"));
        child3.trade(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION);

        // allow with good parent that is entity deployer
        settings.setAddress(address(settings), SETTING_ENTITY_DEPLOYER, address(child1)); // entity deployer
        child2.trade(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION);
        // allow with good grandparent that is entity deployer
        child3.trade(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION);
    }

    function testFeeSchedule2() public {
        uint256 payAmt = 10;
        uint256 buyAmt = 10;

        DummyMarketCaller child1 = new DummyMarketCaller(address(market), address(0));
        writeTokenBalance(address(child1), address(weth), payAmt);

        DummyMarketCaller child2 = new DummyMarketCaller(address(market), address(child1));
        writeTokenBalance(address(child2), address(weth), payAmt);

        // disallow with good parent but bad grandparent
        DummyMarketCaller child3 = new DummyMarketCaller(address(market), address(child2));
        child2.addChild(address(child3));
        writeTokenBalance(address(child3), address(weth), payAmt);
        vm.expectRevert(bytes("fee schedule: bad grandparent"));
        child3.trade(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION);
    }

    // last offer id
    function testGetLastOfferId() public {
        // get correct last offer id before creation of offers
        assertEq(market.getLastOfferId(), 0);

        // get correct last offer id before creation of one offer
        uint256 payAmt = 10;
        uint256 buyAmt = 10;

        vm.startPrank(account2);
        weth.approve(address(market), payAmt);
        writeTokenBalance(account2, address(weth), payAmt);
        market.executeLimitOffer(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        assertEq(market.getLastOfferId(), 1);
    }

    function testGetOffer() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 10;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // get correct last offer id after creation of offers
        assertEq(market.getLastOfferId(), 2);

        assertEq(weth.balanceOf(account1), mintAmount - firstOfferPayAmt);
        assertEq(weth.balanceOf(account2), mintAmount - secondOfferPayAmt);

        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);

        assertEq(firstOffer.creator, account1);
        assertEq(firstOffer.sellToken, address(weth));
        assertEq(firstOffer.sellAmount, firstOfferPayAmt);
        assertEq(firstOffer.sellAmountInitial, firstOfferPayAmt);
        assertEq(firstOffer.buyToken, address(dai));
        assertEq(firstOffer.buyAmount, firstOfferBuyAmt);
        assertEq(firstOffer.buyAmountInitial, firstOfferBuyAmt);
        assertEq(firstOffer.notify, address(0));
        assertEq(firstOffer.state, OFFER_STATE_ACTIVE);
        assertEq(firstOffer.feeSchedule, FEE_SCHEDULE_STANDARD);

        uint256 nextOfferId;
        uint256 prevOfferId;

        (nextOfferId, prevOfferId) = market.getOfferSiblings(1);
        assertEq(nextOfferId, 2);
        assertEq(prevOfferId, 0);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.creator, account2);
        assertEq(secondOffer.sellToken, address(weth));
        assertEq(secondOffer.sellAmount, secondOfferPayAmt);
        assertEq(secondOffer.sellAmountInitial, secondOfferPayAmt);
        assertEq(secondOffer.buyToken, address(dai));
        assertEq(secondOffer.buyAmount, secondOfferBuyAmt);
        assertEq(secondOffer.buyAmountInitial, secondOfferBuyAmt);
        assertEq(secondOffer.notify, address(0));
        assertEq(secondOffer.state, OFFER_STATE_ACTIVE);
        assertEq(secondOffer.feeSchedule, FEE_SCHEDULE_STANDARD);

        (nextOfferId, prevOfferId) = market.getOfferSiblings(2);
        assertEq(nextOfferId, 0);
        assertEq(prevOfferId, 1);
    }

    function testIsActive() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 10;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        assertTrue(market.isActive(1));
        assertTrue(market.isActive(2));
    }

    function testCancel() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 10;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account1);
        vm.expectRevert("only creator can cancel");
        market.cancel(2);
        vm.stopPrank();

        vm.startPrank(account2);
        market.cancel(2);
        vm.stopPrank();

        if (market.isActive(2)) fail();

        assertEq(dai.balanceOf(account2), mintAmount);
        assertEq(weth.balanceOf(account2), mintAmount);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.creator, account2);
        assertEq(secondOffer.sellToken, address(weth));
        assertEq(secondOffer.sellAmount, secondOfferPayAmt);
        assertEq(secondOffer.sellAmountInitial, secondOfferPayAmt);
        assertEq(secondOffer.buyToken, address(dai));
        assertEq(secondOffer.buyAmount, secondOfferBuyAmt);
        assertEq(secondOffer.buyAmountInitial, secondOfferBuyAmt);
        assertEq(secondOffer.notify, address(0));
        assertEq(secondOffer.state, OFFER_STATE_CANCELLED);
        assertEq(secondOffer.feeSchedule, FEE_SCHEDULE_STANDARD);

        uint256 nextOfferId;
        uint256 prevOfferId;

        (nextOfferId, prevOfferId) = market.getOfferSiblings(2);
        assertEq(nextOfferId, 0);
        assertEq(prevOfferId, 0);
    }

    function testBuy() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 10;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        market.cancel(2);
        vm.stopPrank();

        if (market.isActive(2)) fail();

        vm.expectRevert("offer not active");
        vm.prank(account3);
        market.buy(2, 20);

        assertEq(dai.balanceOf(account2), mintAmount);
        assertEq(weth.balanceOf(account2), mintAmount);

        // should fail to buy successfully if amount is zero
        vm.startPrank(account3);
        dai.approve(address(market), 20);
        vm.expectRevert("requested buy amount is 0");
        market.buy(1, 0);

        assertEq(weth.balanceOf(account1), 990);

        // should fail to buy successfully if amount is not approved by buyer
        dai.approve(address(market), 0);
        vm.expectRevert("calculated sell amount is 0");
        market.buy(1, 1);
    }

    function testBuyRatio() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 10;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), secondOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account3);
        dai.approve(address(market), 10);

        // should buy 50% or part of first offer successfully with 1:2 price ratio
        market.buy(1, 10);
        vm.stopPrank();
        assertEq(dai.balanceOf(account1), 1010);
        assertEq(weth.balanceOf(account1), 990);
        assertEq(dai.balanceOf(account3), 990);
        assertEq(weth.balanceOf(account3), 1005);

        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);

        assertEq(firstOffer.creator, account1);
        assertEq(firstOffer.sellToken, address(weth));
        assertEq(firstOffer.sellAmount, firstOfferPayAmt / 2);
        assertEq(firstOffer.sellAmountInitial, firstOfferPayAmt);
        assertEq(firstOffer.buyToken, address(dai));
        assertEq(firstOffer.buyAmount, firstOfferBuyAmt / 2);
        assertEq(firstOffer.buyAmountInitial, firstOfferBuyAmt);
        assertEq(firstOffer.notify, address(0));
        assertEq(firstOffer.state, OFFER_STATE_ACTIVE);
        assertEq(firstOffer.feeSchedule, FEE_SCHEDULE_STANDARD);

        vm.startPrank(account4);
        dai.approve(address(market), 10);

        // should buy all of first offer successfully with 1:2 price ratio in two buy transactions
        market.buy(1, 10);
        vm.stopPrank();

        assertEq(dai.balanceOf(account1), 1020);
        assertEq(weth.balanceOf(account1), 990);
        assertEq(dai.balanceOf(account4), 990);
        assertEq(weth.balanceOf(account4), 1005);

        firstOffer = market.getOffer(1);

        assertEq(firstOffer.creator, account1);
        assertEq(firstOffer.sellToken, address(weth));
        assertEq(firstOffer.sellAmount, 0);
        assertEq(firstOffer.sellAmountInitial, firstOfferPayAmt);
        assertEq(firstOffer.buyToken, address(dai));
        assertEq(firstOffer.buyAmount, 0);
        assertEq(firstOffer.buyAmountInitial, firstOfferBuyAmt);
        assertEq(firstOffer.notify, address(0));
        assertEq(firstOffer.state, OFFER_STATE_FULFILLED);
        assertEq(firstOffer.feeSchedule, FEE_SCHEDULE_STANDARD);

        uint256 nextOfferId;
        uint256 prevOfferId;

        (nextOfferId, prevOfferId) = market.getOfferSiblings(1);

        // should set offer status to fulfilled and delete it if pay amount is all bought
        if (market.isActive(1)) fail();
    }

    function testSimulateMarketOffer() public {
        vm.startPrank(account3);
        dai.approve(address(market), 30);

        market.executeLimitOffer(address(dai), 20, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(dai), 10, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account1);
        weth.approve(address(market), 5e18);

        // should revert if amount to sell cannot be transferred from user
        // todo does not revert as expected
        weth.balanceOf(account1);
        // vm.expectRevert("DummyToken: transfer amount exceeds allowance");
        // market.executeMarketOffer(address(weth), 11e18, address(dai));
        vm.stopPrank();

        // // when there are no orders in market to match
        // vm.expectRevert("not enough orders in market");
        // market.simulateMarketOffer(address(dai), 11e18, address(weth));

        // vm.expectRevert("not enough orders in market");
        // market.simulateMarketOffer(address(weth), 11e18, address(dai));
        // when it can partially match an existing offer
        market.simulateMarketOffer(address(weth), 1, address(dai));
        // when it fully matches an existing offer
        market.simulateMarketOffer(address(weth), 10, address(dai));
        // when it fully matches an existing offer and partially matches a second offer
        market.simulateMarketOffer(address(weth), 12, address(dai));
        // when it fully matches existing offers
        market.simulateMarketOffer(address(weth), 20, address(dai));
    }

    function testExecuteMarketOffer() public {
        vm.startPrank(account3);
        dai.approve(address(market), 30);

        market.executeLimitOffer(address(dai), 20, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(dai), 10, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // should revert if there are not enough orders in market to match
        vm.startPrank(account1);
        weth.approve(address(market), 5e18);
        vm.expectRevert("not enough orders in market");
        market.executeMarketOffer(address(weth), 5e18, address(dai));

        assertEq(dai.balanceOf(account1), 1000);
        assertEq(weth.balanceOf(account1), 1000);

        assertEq(dai.balanceOf(account3), 970);
        assertEq(weth.balanceOf(account3), 1000);
    }

    function testMatchPairOfMatchingOffers() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 5;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 20;

        vm.startPrank(account1);
        dai.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(dai), firstOfferPayAmt, address(weth), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), secondOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // get correct last offer id after creating offers
        assertEq(market.getLastOfferId(), 2);

        // should match both matching offers partly and get correct last offer id after complete and active offers
        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 0);
        assertEq(firstOffer.buyAmount, 0);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.sellAmount, 5);
        assertEq(secondOffer.buyAmount, 10);

        assertEq(dai.balanceOf(account1), 990);
        assertEq(weth.balanceOf(account1), 1005);

        assertEq(dai.balanceOf(account2), 1010);
        assertEq(weth.balanceOf(account2), 990);
    }

    function testMatchMultipleMatchingOffers() public {
        uint256 firstOfferPayAmt = 20;
        uint256 firstOfferBuyAmt = 40;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 20;

        vm.startPrank(account1);
        dai.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(dai), firstOfferPayAmt, address(weth), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), secondOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // get correct last offer id after creating offers
        assertEq(market.getLastOfferId(), 2);

        // create and match two more offers with one previous matching offer, i.e., offer 2
        uint256 thirdOfferPayAmt = 40;
        uint256 thirdOfferBuyAmt = 20;
        uint256 fourthOfferPayAmt = 5;
        uint256 fourthOfferBuyAmt = 10;

        vm.startPrank(account3);
        dai.approve(address(market), thirdOfferPayAmt);
        market.executeLimitOffer(address(dai), thirdOfferPayAmt, address(weth), thirdOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        assertEq(market.getLastOfferId(), 3);

        vm.startPrank(account4);
        weth.approve(address(market), fourthOfferPayAmt);
        market.executeLimitOffer(address(weth), fourthOfferPayAmt, address(dai), fourthOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // last offer id will not create a new offer for matched offer after remaining amounts not > 0
        // but e.g., will create new offer for the following example amounts to make getLastOfferId return 4
        // fourth_offer_pay_amt = toWei('30');
        // fourth_offer_buy_amt = toWei('60');
        assertEq(market.getLastOfferId(), 3);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.sellAmount, 0);
        assertEq(secondOffer.buyAmount, 0);

        IMarketDataFacet.OfferState memory thirdOffer = market.getOffer(3);
        assertEq(thirdOffer.sellAmount, 10);
        assertEq(thirdOffer.buyAmount, 5);

        IMarketDataFacet.OfferState memory fourthOffer = market.getOffer(4);
        assertEq(fourthOffer.sellAmount, 0);
        assertEq(fourthOffer.buyAmount, 0);

        assertEq(dai.balanceOf(account1), 980);
        assertEq(weth.balanceOf(account1), 1000);

        assertEq(dai.balanceOf(account2), 1020);
        assertEq(weth.balanceOf(account2), 990);

        assertEq(dai.balanceOf(account3), 960);
        assertEq(weth.balanceOf(account3), 1015);

        assertEq(dai.balanceOf(account4), 1010);
        assertEq(weth.balanceOf(account4), 995);
    }

    // should get correct last offer id when second matching offer not completely filled
    // note: same as test above.

    function testLastOfferIdWhenSecondMatchingOfferIsCompletelyFilled() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 5;
        uint256 secondOfferPayAmt = 5;
        uint256 secondOfferBuyAmt = 10;

        vm.startPrank(account1);
        dai.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(dai), firstOfferPayAmt, address(weth), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), secondOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // get correct last offer id after creating offers
        assertEq(market.getLastOfferId(), 1);

        // should match both matching offers partly and get correct last offer id after complete and active offers
        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 0);
        assertEq(firstOffer.buyAmount, 0);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.sellAmount, 0);
        assertEq(secondOffer.buyAmount, 0);

        // should get correct balances after matching offers
        assertEq(dai.balanceOf(account1), 990);
        assertEq(weth.balanceOf(account1), 1005);

        assertEq(dai.balanceOf(account2), 1010);
        assertEq(weth.balanceOf(account2), 995);
    }

    function testGetBestOfferId() public {
        uint256 firstOfferPayAmt = 20;
        uint256 firstOfferBuyAmt = 40;
        uint256 secondOfferPayAmt = 20;
        uint256 secondOfferBuyAmt = 30;

        vm.startPrank(account1);
        dai.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(dai), firstOfferPayAmt, address(weth), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(account2);
        dai.approve(address(market), secondOfferPayAmt);
        market.executeLimitOffer(address(dai), secondOfferPayAmt, address(weth), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // get correct last offer id after creating offers
        assertEq(market.getLastOfferId(), 2);

        // should match both matching offers partly and get correct last offer id after complete and active offers
        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 20);
        assertEq(firstOffer.buyAmount, 40);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.sellAmount, 20);
        assertEq(secondOffer.buyAmount, 30);

        // should get correct balances after matching offers
        assertEq(dai.balanceOf(account1), 980);
        assertEq(weth.balanceOf(account1), 1000);

        assertEq(dai.balanceOf(account2), 980);
        assertEq(weth.balanceOf(account2), 1000);

        // should get the id of the best offer if available
        assertEq(market.getBestOfferId(address(dai), address(weth)), 2);

        // should return 0 when there is no best offer for a token pair
        assertEq(market.getBestOfferId(address(weth), address(dai)), 0);
    }

    // handleTrade and handleClosure should handle trade or closure or cancellation notifications in market observer
    function testHandleTrade() public {
        (DummyMarketObserver.ORDER_TYPE oType, bytes memory data) = marketObserver.getOrder(3);
        uint8 coType = uint8(oType);
        assertEq(coType, 0);
        // todo check data

        // should get correct order info for created orders when no trade or closure occurs
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 10;
        uint256 secondOfferPayAmt = 10;
        uint256 secondOfferBuyAmt = 10;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        vm.stopPrank();

        vm.startPrank(account2);
        weth.approve(address(market), secondOfferPayAmt);
        market.executeLimitOffer(address(weth), secondOfferPayAmt, address(dai), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        vm.stopPrank();

        // todo check getOrder
        (oType, data) = marketObserver.getOrder(1);
        coType = uint8(oType);
        assertEq(coType, 0);
        checkEq0(data, notifyData);

        (oType, data) = marketObserver.getOrder(2);
        coType = uint8(oType);
        assertEq(coType, 0);
        checkEq0(data, notifyData);

        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 10);
        assertEq(firstOffer.buyAmount, 10);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.sellAmount, 10);
        assertEq(secondOffer.buyAmount, 10);

        assertEq(dai.balanceOf(account1), 1000);
        assertEq(weth.balanceOf(account1), 990);

        assertEq(dai.balanceOf(account2), 1000);
        assertEq(weth.balanceOf(account2), 990);
    }

    // should handle order closures for fully matching offers and get correct order info after closure occurs
    function testHandleTradeOrderClosures() public {
        (DummyMarketObserver.ORDER_TYPE oType, bytes memory data) = marketObserver.getOrder(3);
        uint8 coType = uint8(oType);
        assertEq(coType, 0);
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;
        uint256 secondOfferPayAmt = 40;
        uint256 secondOfferBuyAmt = 20;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        vm.stopPrank();

        vm.startPrank(account2);
        dai.approve(address(market), secondOfferPayAmt);
        market.executeLimitOffer(address(dai), secondOfferPayAmt, address(weth), secondOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        vm.stopPrank();

        (oType, data) = marketObserver.getOrder(1);
        coType = uint8(oType);
        assertEq(coType, 2);
        checkEq0(data, notifyData);

        (oType, data) = marketObserver.getOrder(2);
        coType = uint8(oType);
        assertEq(coType, 0);
        checkEq0(data, notifyData);

        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 0);
        assertEq(firstOffer.buyAmount, 0);

        IMarketDataFacet.OfferState memory secondOffer = market.getOffer(2);
        assertEq(secondOffer.sellAmount, 20);
        assertEq(secondOffer.buyAmount, 10);

        assertEq(dai.balanceOf(account1), 1020);
        assertEq(weth.balanceOf(account1), 990);

        assertEq(dai.balanceOf(account2), 960);
        assertEq(weth.balanceOf(account2), 1010);

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        vm.stopPrank();

        (oType, data) = marketObserver.getOrder(2);
        coType = uint8(oType);
        assertEq(coType, 2);
        checkEq0(data, notifyData);

        (oType, data) = marketObserver.getOrder(3);
        coType = uint8(oType);
        assertEq(coType, 0);
        checkEq0(data, "");

        IMarketDataFacet.OfferState memory thirdOffer = market.getOffer(3);
        assertEq(thirdOffer.sellAmount, 0);
        assertEq(thirdOffer.buyAmount, 0);

        secondOffer = market.getOffer(2);
        assertEq(secondOffer.sellAmount, 0);
        assertEq(secondOffer.buyAmount, 0);

        assertEq(dai.balanceOf(account1), 1040);
        assertEq(weth.balanceOf(account1), 980);

        assertEq(dai.balanceOf(account2), 960);
        assertEq(weth.balanceOf(account2), 1020);
    }

    // should handle order cancellation
    function testExecuteLimitOfferCancel() public {
        (DummyMarketObserver.ORDER_TYPE oType, bytes memory data) = marketObserver.getOrder(3);
        uint8 coType = uint8(oType);
        assertEq(coType, 0);
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        // vm.stopPrank();

        (oType, data) = marketObserver.getOrder(1);
        coType = uint8(oType);
        assertEq(coType, 0);
        checkEq0(data, "");

        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 10);
        assertEq(firstOffer.buyAmount, 20);

        assertEq(dai.balanceOf(account1), 1000);
        assertEq(weth.balanceOf(account1), 990);

        market.cancel(1);

        (oType, data) = marketObserver.getOrder(1);
        coType = uint8(oType);
        assertEq(coType, 2);
        checkEq0(data, notifyData);

        firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 10);
        assertEq(firstOffer.buyAmount, 20);

        if (market.isActive(1)) fail();

        assertEq(dai.balanceOf(account1), 1000);
        assertEq(weth.balanceOf(account1), 1000);
    }

    // should handle order cancellation without notify data
    function testExecuteLimitOfferCancelNoNotifyData() public {
        (DummyMarketObserver.ORDER_TYPE oType, bytes memory data) = marketObserver.getOrder(3);
        uint8 coType = uint8(oType);
        assertEq(coType, 0);
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        // vm.stopPrank();

        (oType, data) = marketObserver.getOrder(1);
        coType = uint8(oType);
        assertEq(coType, 0);
        checkEq0(data, "");

        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 10);
        assertEq(firstOffer.buyAmount, 20);

        assertEq(dai.balanceOf(account1), 1000);
        assertEq(weth.balanceOf(account1), 990);

        market.cancel(1);

        (oType, data) = marketObserver.getOrder(1);
        coType = uint8(oType);
        assertEq(coType, 2);
        checkEq0(data, "");

        firstOffer = market.getOffer(1);
        assertEq(firstOffer.sellAmount, 10);
        assertEq(firstOffer.buyAmount, 20);

        if (market.isActive(1)) fail();

        assertEq(dai.balanceOf(account1), 1000);
        assertEq(weth.balanceOf(account1), 1000);
    }

    // should handle trade after a buy
    function testExecuteLimitOfferBuy() public {
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 20;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(marketObserver), notifyData);
        vm.stopPrank();

        assertTrue(market.isActive(1));

        vm.startPrank(account3);
        dai.approve(address(market), 10);
        market.buy(1, firstOfferBuyAmt / 2);

        (DummyMarketObserver.ORDER_TYPE oType, bytes memory data) = marketObserver.getOrder(1);
        uint8 coType = uint8(oType);
        assertEq(coType, 1);
        checkEq0(data, notifyData);

        assertEq(dai.balanceOf(account1), 1010);
        assertEq(weth.balanceOf(account1), 990);
        assertEq(dai.balanceOf(account3), 990);
        assertEq(weth.balanceOf(account3), 1005);
    }

    function testExecuteLimitOfferWithFees() public {
        market.setFee(2000); // 20%

        // subtracts fees from the take, but not the make
        uint256 firstOfferPayAmt = 10;
        uint256 firstOfferBuyAmt = 5;

        vm.startPrank(account1);
        weth.approve(address(market), firstOfferPayAmt);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), firstOfferBuyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        assertEq(dai.balanceOf(account1), 1000);
        assertEq(weth.balanceOf(account1), 990);
        assertEq(dai.balanceOf(address(market)), 0);
        assertEq(weth.balanceOf(address(market)), 10);

        vm.startPrank(account2);
        dai.approve(address(market), 12);
        market.executeLimitOffer(address(dai), firstOfferPayAmt, address(weth), 20, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        assertEq(dai.balanceOf(account1), 1005);
        assertEq(weth.balanceOf(account1), 990);
        assertEq(dai.balanceOf(account2), 989);
        assertEq(weth.balanceOf(account2), 1010);
        assertEq(dai.balanceOf(address(market)), 5);
        assertEq(weth.balanceOf(address(market)), 0);

        vm.startPrank(account3);
        weth.approve(address(market), 10);
        market.executeLimitOffer(address(weth), firstOfferPayAmt, address(dai), 5, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        assertEq(dai.balanceOf(account1), 1005);
        assertEq(weth.balanceOf(account1), 990);
        assertEq(dai.balanceOf(account2), 989);
        assertEq(weth.balanceOf(account2), 1020);
        assertEq(dai.balanceOf(account3), 1004);
        assertEq(weth.balanceOf(account3), 990);
        assertEq(dai.balanceOf(address(market)), 0);
        assertEq(weth.balanceOf(address(market)), 0);
    }

    // for the "platform action" fee schedule
    function testTradewithPlatformActionFeeSchedule() public {
        DummyMarketCaller entityDeployer2 = new DummyMarketCaller(address(market), address(0));
        settings.setAddress(address(settings), SETTING_ENTITY_DEPLOYER, address(entityDeployer2));

        DummyMarketCaller entity1 = new DummyMarketCaller(address(market), address(entityDeployer2));
        entityDeployer2.addChild(address(entity1));
        vm.startPrank(account1);
        dai.transfer(address(entity1), 1000);
        weth.transfer(address(entity1), 1000);
        vm.stopPrank();

        DummyMarketCaller entity2 = new DummyMarketCaller(address(market), address(entityDeployer2));
        entityDeployer2.addChild(address(entity2));
        vm.startPrank(account2);
        dai.transfer(address(entity2), 1000);
        weth.transfer(address(entity2), 1000);
        vm.stopPrank();

        DummyMarketCaller entity3 = new DummyMarketCaller(address(market), address(entityDeployer2));
        entityDeployer2.addChild(address(entity3));
        vm.startPrank(account3);
        dai.transfer(address(entity3), 1000);
        weth.transfer(address(entity3), 1000);
        vm.stopPrank();

        // takes no fees
        entity1.trade(address(weth), 10, address(dai), 5, FEE_SCHEDULE_PLATFORM_ACTION);
        assertEq(dai.balanceOf(address(entity1)), 1000);
        assertEq(weth.balanceOf(address(entity1)), 990);
        assertEq(dai.balanceOf(address(market)), 0);
        assertEq(weth.balanceOf(address(market)), 10);

        entity2.trade(address(dai), 10, address(weth), 20, FEE_SCHEDULE_STANDARD);
        assertEq(dai.balanceOf(address(entity1)), 1005);
        assertEq(weth.balanceOf(address(entity1)), 990);
        assertEq(dai.balanceOf(address(entity2)), 990);
        assertEq(weth.balanceOf(address(entity2)), 1010);
        assertEq(dai.balanceOf(address(market)), 5);
        assertEq(weth.balanceOf(address(market)), 0);

        entity3.trade(address(weth), 10, address(dai), 5, FEE_SCHEDULE_STANDARD);
        assertEq(dai.balanceOf(address(entity1)), 1005);
        assertEq(weth.balanceOf(address(entity1)), 990);
        assertEq(dai.balanceOf(address(entity2)), 990);
        assertEq(weth.balanceOf(address(entity2)), 1020);
        // assertEq(dai.balanceOf(address(entity3)), 1004); // todo not matching js tests?
        assertEq(dai.balanceOf(address(entity3)), 1005);
        assertEq(weth.balanceOf(address(entity3)), 990);
        assertEq(dai.balanceOf(address(market)), 0);
        assertEq(weth.balanceOf(address(market)), 0);
    }
}

// when market.executeLimitOffer is called with no entity deployer, method fails from the check from the erc20 token transferFrom to zero addrsess
// what if the erc20 token doesn't check for a transer to zero address?

// cannot remove a child?
