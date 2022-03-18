// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./utils/DSTestPlusF.sol";

import {IACLConstants} from "../../contracts/base/IACLConstants.sol";
import {ISettingsKeys} from "../../contracts/base/ISettingsKeys.sol";
import {AccessControl} from "../../contracts/base/AccessControl.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from "../../contracts/Settings.sol";
import {ISettings} from "../../contracts/base/ISettings.sol";

import {IMarket} from "../../contracts/base/IMarket.sol";
import {IMarketFeeSchedules} from "../../contracts/base/IMarketFeeSchedules.sol";
import {Market} from "../../contracts/Market.sol";
import {MarketCoreFacet} from "../../contracts/MarketCoreFacet.sol";
import {MarketDataFacet} from "../../contracts/MarketDataFacet.sol";

import {FeeBank} from "../../contracts/FeeBank.sol";
import {FeeBankCoreFacet} from "../../contracts/FeeBankCoreFacet.sol";

import {DummyToken} from "../../contracts/DummyToken.sol";

import {EntityDeployer} from "../../contracts/EntityDeployer.sol";

import {DummyMarketCaller} from "../../contracts/test/DummyMarketCaller.sol";

contract MarketTest is DSTestPlusF, IACLConstants, ISettingsKeys, IMarketFeeSchedules {
    ACL internal acl;
    Settings internal settings;
    AccessControl internal accessControl;

    bytes32 internal systemContext;

    FeeBank internal feeBank;
    FeeBankCoreFacet internal feeBankCoreFacet;

    Market internal market;
    MarketCoreFacet internal mcf;
    MarketDataFacet internal mdf;

    DummyToken internal dai;
    DummyToken internal dai2;
    DummyToken internal weth;
    DummyToken internal weth2;

    EntityDeployer internal eDep;

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        accessControl = new AccessControl(address(settings));
        systemContext = acl.systemContext();

        feeBank = new FeeBank(address(settings));
        feeBankCoreFacet = new FeeBankCoreFacet(address(settings));

        eDep = new EntityDeployer(address(settings));

        mcf = new MarketCoreFacet(address(settings));
        mdf = new MarketDataFacet(address(settings));

        // vm.prank(address())
        dai = new DummyToken("Dai Stablecoin", "DAI", 18, 0, false);
        dai2 = new DummyToken("Dai Stablecoin 2", "DAI2", 18, 0, false);
        weth = new DummyToken("Wrapped ETH", "WETH", 18, 0, true);
        weth2 = new DummyToken("Wrapped ETH 2", "WETH2", 18, 0, true);

        address[] memory addys = new address[](2);
        addys[0] = address(mcf);
        addys[1] = address(mdf);

        settings.setAddresses(address(settings), SETTING_MARKET_IMPL, addys); // facets use the key with suffix _IMPL
        market = new Market(address(settings));

        settings.setAddress(address(settings), SETTING_MARKET, address(market)); // proxy diamond for market
        settings.setAddress(address(settings), SETTING_ENTITY_DEPLOYER, address(eDep)); // entity deployer
        settings.setAddress(address(settings), SETTING_FEEBANK, address(feeBank)); // fee bank
        settings.setAddress(address(settings), SETTING_FEEBANK_IMPL, address(feeBankCoreFacet)); // fee bank facets

        vm.label(address(market), "Market Proxy Diamond");
        vm.label(address(mcf), "Market Core Facet");
        vm.label(address(mdf), "Market Data Facet");
        vm.label(address(acl), "ACL");
        vm.label(address(settings), "Settings");
        vm.label(address(accessControl), "Access Control");
        vm.label(address(eDep), "Entity Deployer");
        vm.label(address(feeBank), "Fee Bank");
        vm.label(address(feeBankCoreFacet), "Fee Bank Core Facet");
        vm.label(address(dai), "DAI");
        vm.label(address(dai2), "DAI2");
        vm.label(address(weth), "WETH");
        vm.label(address(weth2), "WETH2");
        vm.label(address(0xAAAA), "Account 0");
        vm.label(address(0xBEEF), "Account 1");
        vm.label(address(0xCAFE), "Account 2");
        vm.label(address(0xD00D), "Account 3");
        vm.label(address(0xE), "Account 4");
    }

    function testGetConfig() public {
        uint256 dust;
        uint256 feeBP;

        (dust, feeBP) = IMarket(address(market)).getConfig();
        assertEq(dust, 1);
        assertEq(feeBP, 0);
    }

    function testExecuteLimitOffer() public {
        // invalid sell amount
        vm.expectRevert("sell amount must be uint128");
        IMarket(address(market)).executeLimitOffer(
            address(dai),
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
            address(dai),
            20,
            FEE_SCHEDULE_STANDARD,
            address(0),
            ""
        );
        // invalid buy amount
        vm.expectRevert("buy amount must be uint128");
        IMarket(address(market)).executeLimitOffer(
            address(dai),
            20,
            address(dai),
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
            FEE_SCHEDULE_STANDARD,
            address(0),
            ""
        );

        // 0 sell amount
        vm.expectRevert("sell amount must be >0");
        IMarket(address(market)).executeLimitOffer(address(dai), 0, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        // invalid sell token
        vm.expectRevert("sell token must be valid");
        IMarket(address(market)).executeLimitOffer(address(0), 10, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");

        // 0 buy amount
        vm.expectRevert("buy amount must be >0");
        IMarket(address(market)).executeLimitOffer(address(dai), 10, address(weth), 0, FEE_SCHEDULE_STANDARD, address(0), "");

        // invalid buy token
        vm.expectRevert("buy token must be valid");
        IMarket(address(market)).executeLimitOffer(address(dai), 10, address(0), 20, FEE_SCHEDULE_STANDARD, address(0), "");

        // identical buy and sell token
        vm.expectRevert("cannot sell and buy same token");
        IMarket(address(market)).executeLimitOffer(address(dai), 10, address(dai), 20, FEE_SCHEDULE_STANDARD, address(0), "");
    }

    function testFee() public {
        vm.expectRevert("must be admin");
        vm.prank(address(0xBEEF));
        IMarket(address(market)).setFee(2);
        // can be changed
        IMarket(address(market)).setFee(2);
        uint256 dust;
        uint256 feeBP;
        (dust, feeBP) = IMarket(address(market)).getConfig();
        assertEq(dust, 1);
        assertEq(feeBP, 2);

        // can be calculated per order
        IMarket(address(market)).setFee(2000);

        // but not if order uses two platform tokens
        vm.expectRevert("must be one platform token");
        IMarket(address(market)).calculateFee(address(weth), 10, address(weth2), 5, FEE_SCHEDULE_STANDARD);

        // but not if order uses two currency tokens
        vm.expectRevert("must be one platform token");
        IMarket(address(market)).calculateFee(address(dai), 10, address(dai2), 5, FEE_SCHEDULE_STANDARD);

        // and is always based on currency unit
        address feeToken;
        uint256 feeAmount;
        (feeToken, feeAmount) = IMarket(address(market)).calculateFee(address(weth), 10, address(dai), 5, FEE_SCHEDULE_STANDARD);
        assertEq(feeToken, address(dai));
        assertEq(feeAmount, 1);

        (feeToken, feeAmount) = IMarket(address(market)).calculateFee(address(dai), 10, address(weth), 5, FEE_SCHEDULE_STANDARD);
        assertEq(feeToken, address(dai));
        assertEq(feeAmount, 2);

        // and is 0 for platform actions
        (feeToken, feeAmount) = IMarket(address(market)).calculateFee(address(weth), 10, address(dai), 5, FEE_SCHEDULE_PLATFORM_ACTION);
        assertEq(feeToken, address(dai));
        assertEq(feeAmount, 0);
    }

    // platform token check
    function testPlatformToken() public {
        // does not allow 2 non-platform tokens
        uint256 payAmt = 10;
        uint256 buyAmt = 10;

        vm.startPrank(address(0xCAFE));
        dai.approve(address(market), payAmt);

        vm.expectRevert("must be one platform token");
        IMarket(address(market)).executeLimitOffer(address(dai), payAmt, address(dai2), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");

        // does not allow 2 platform tokens
        vm.expectRevert("must be one platform token");
        IMarket(address(market)).executeLimitOffer(address(weth), payAmt, address(weth2), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");

        // does allow 1 platform token
        weth.approve(address(market), payAmt);
        writeTokenBalance(address(0xCAFE), address(weth), 10);
        IMarket(address(market)).executeLimitOffer(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        writeTokenBalance(address(0xCAFE), address(dai), 10);
        IMarket(address(market)).executeLimitOffer(address(dai), payAmt, address(weth), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
    }

    function testFeeSchedule() public {
        uint256 payAmt = 10;
        uint256 buyAmt = 10;

        // disallow arbitrary caller
        vm.expectRevert(bytes(""));
        IMarket(address(market)).executeLimitOffer(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_PLATFORM_ACTION, address(0), "");

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
        assertEq(IMarket(address(market)).getLastOfferId(), 0);

        // get correct last offer id before creation of one offer
        uint256 payAmt = 10;
        uint256 buyAmt = 10;

        vm.startPrank(address(0xCAFE));
        weth.approve(address(market), payAmt);
        writeTokenBalance(address(0xCAFE), address(weth), payAmt);
        IMarket(address(market)).executeLimitOffer(address(weth), payAmt, address(dai), buyAmt, FEE_SCHEDULE_STANDARD, address(0), "");
        assertEq(IMarket(address(market)).getLastOfferId(), 1);
    }
}

// when market.executeLimitOffer is called with no entity deployer, method fails from the check from the erc20 token transferFrom to zero addrsess
// what if the erc20 token doesn't check for a transer to zero address?

// cannot remove a child?
