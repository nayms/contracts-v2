// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityTokensFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/IMarketObserver.sol";
import "./base/IMarketObserverDataTypes.sol";
import "./base/Strings.sol";
import "./EntityFacetBase.sol";
import "./EntityToken.sol";
import { Address } from "./base/Address.sol";

contract EntityTokensFacet is EternalStorage, Controller, EntityFacetBase, IEntityTokensFacet, IMarketObserver, IMarketObserverDataTypes, IDiamondFacet {
    using Strings for string;
    using Address for address;

    modifier assertCanStartTokenSale() {
        require(inRoleGroup(msg.sender, ROLEGROUP_SYSTEM_MANAGERS), "must be system mgr");
        _;
    }

    modifier assertCanCancelTokenSale() {
        require(inRoleGroup(msg.sender, ROLEGROUP_SYSTEM_MANAGERS), "must be system mgr");
        _;
    }

    /**
     * Constructor
     */
    constructor(address _settings) Controller(_settings) {}

    // IDiamondFacet

    function getSelectors() public pure override returns (bytes memory) {
        return
            abi.encodePacked(
                IEntityTokensFacet.getTokenInfo.selector,
                IEntityTokensFacet.burnTokens.selector,
                IEntityTokensFacet.startTokenSale.selector,
                IEntityTokensFacet.cancelTokenSale.selector,
                IEntityTokensFacet.tknName.selector,
                IEntityTokensFacet.tknSymbol.selector,
                IEntityTokensFacet.tknTotalSupply.selector,
                IEntityTokensFacet.tknBalanceOf.selector,
                IEntityTokensFacet.tknAllowance.selector,
                IEntityTokensFacet.tknApprove.selector,
                IEntityTokensFacet.tknTransfer.selector,
                IMarketObserver.handleTrade.selector,
                IMarketObserver.handleClosure.selector
            );
    }

    // IEntityTokensFacet

    function getTokenInfo(address _unit) external view override returns (address tokenContract_, uint256 currentTokenSaleOfferId_) {
        tokenContract_ = dataAddress[__a(_unit, "token")];
        currentTokenSaleOfferId_ = dataUint256[__a(_unit, "tokenSaleOfferId")];
    }

    function burnTokens(address _unit, uint256 _amount) external override {
        _burn(_unit, msg.sender, _amount);
    }

    function startTokenSale(
        uint256 _amount,
        address _priceUnit,
        uint256 _totalPrice
    ) external override assertCanStartTokenSale {
        _assertNoTokenSaleInProgress(_priceUnit);

        // mint token if it doesn't exist for given unit
        if (dataAddress[__a(_priceUnit, "token")] == address(0)) {
            dataAddress[__a(_priceUnit, "token")] = address(new EntityToken(address(this), _priceUnit));
        }

        dataUint256[__aa(_priceUnit, address(this), "tokenBalance")] += _amount;
        dataUint256[__a(_priceUnit, "tokenSupply")] += _amount;

        IMarket mkt = _getMarket();

        // approve market contract to use my tokens
        IERC20 tok = IERC20(dataAddress[__a(_priceUnit, "token")]);
        tok.approve(address(mkt), _amount);

        uint256 offerId = mkt.executeLimitOffer(
            dataAddress[__a(_priceUnit, "token")],
            _amount,
            _priceUnit,
            _totalPrice,
            FEE_SCHEDULE_PLATFORM_ACTION,
            address(this),
            abi.encode(MODT_ENTITY_SALE, address(this))
        );

        // setup lookup tables
        dataUint256[__a(_priceUnit, "tokenSaleOfferId")] = offerId;
        dataAddress[__i(offerId, "offerUnit")] = _priceUnit;
    }

    function cancelTokenSale(address _unit) external override assertCanCancelTokenSale {
        uint256 offerId = dataUint256[__a(_unit, "tokenSaleOfferId")];
        require(offerId > 0, "no active token sale");
        _getMarket().cancel(offerId);
    }

    function tknName(address _unit) public view override returns (string memory) {
        return string(abi.encodePacked("NAYMS-", _unit.toString(), "-", address(this).toString(), "-ENTITY"));
    }

    function tknSymbol(address _unit) public view override returns (string memory) {
        // max len = 11 chars
        return string(abi.encodePacked("N-", _unit.toString().substring(2, 3), "-", address(this).toString().substring(2, 3), "-E"));
    }

    function tknTotalSupply(address _unit) public view override returns (uint256) {
        return dataUint256[__a(_unit, "tokenSupply")];
    }

    function tknBalanceOf(address _unit, address _owner) public view override returns (uint256) {
        string memory k = __aa(_unit, _owner, "tokenBalance");
        return dataUint256[k];
    }

    function tknAllowance(
        address _unit,
        address _spender,
        address _owner
    ) public view override returns (uint256) {
        string memory k = __iaaa(0, _owner, _spender, _unit, "tokenAllowance");
        return dataUint256[k];
    }

    function tknApprove(
        address, /*_unit*/
        address _spender,
        address, /*_from*/
        uint256 /*_value*/
    ) public override {
        require(_spender == settings().getRootAddress(SETTING_MARKET), "only nayms market is allowed to transfer");
    }

    function tknTransfer(
        address _unit,
        address _spender,
        address _from,
        address _to,
        uint256 _value
    ) public override {
        require(_spender == settings().getRootAddress(SETTING_MARKET), "only nayms market is allowed to transfer");
        _transfer(_unit, _from, _to, _value);
    }

    // IMarketObserver

    function handleTrade(
        uint256 _offerId,
        uint256, /*_soldAmount*/
        uint256 _boughtAmount,
        address, /*_feeToken*/
        uint256, /*_feeAmount*/
        address, /*_buyer*/
        bytes memory _data
    ) external override {
        if (_data.length == 0) {
            return;
        }

        // get data type
        uint256 t = abi.decode(_data, (uint256));

        // if it's an entity token sale
        if (t == MODT_ENTITY_SALE) {
            // get entity address
            (, address entity) = abi.decode(_data, (uint256, address));

            // if we created this offer
            if (entity == address(this)) {
                // check entity token matches sell token
                IMarketDataFacet.OfferState memory offerState = _getMarket().getOffer(_offerId);
                address unit = dataAddress[__i(_offerId, "offerUnit")];
                address tokenAddress = dataAddress[__a(unit, "token")];
                require(tokenAddress == offerState.sellToken, "sell token must be entity token");

                // add bought amount to balance
                string memory balKey = __a(offerState.buyToken, "balance");
                dataUint256[balKey] = dataUint256[balKey] + _boughtAmount;
            }
        }
    }

    function handleClosure(
        uint256 _offerId,
        uint256 _unsoldAmount,
        uint256, /*_unboughtAmount*/
        bytes memory _data
    ) external override {
        if (_data.length == 0) {
            return;
        }

        // get data type
        uint256 t = abi.decode(_data, (uint256));

        // if it's an entity token sale
        if (t == MODT_ENTITY_SALE) {
            // get entity address
            (, address entity) = abi.decode(_data, (uint256, address));

            // if we created this offer
            if (entity == address(this)) {
                // check entity token matches sell token
                IMarketDataFacet.OfferState memory offerState = _getMarket().getOffer(_offerId);
                address unit = dataAddress[__i(_offerId, "offerUnit")];
                address tokenAddress = dataAddress[__a(unit, "token")];
                require(tokenAddress == offerState.sellToken, "sell token must be entity token");

                // burn the unsold amount (currently owned by the entity since the market has already sent it back)
                if (_unsoldAmount > 0) {
                    _burn(unit, address(this), _unsoldAmount);
                }

                // reset sale id
                dataUint256[__a(unit, "tokenSaleOfferId")] = 0;
            }
        }
    }

    // Internal functions

    function _transfer(
        address _unit,
        address _from,
        address _to,
        uint256 _value
    ) private {
        require(_value > 0, "cannot transfer zero");

        string memory fromBalanceKey = __aa(_unit, _from, "tokenBalance");
        string memory toBalanceKey = __aa(_unit, _to, "tokenBalance");

        require(dataUint256[fromBalanceKey] >= _value, "not enough balance");

        dataUint256[fromBalanceKey] -= _value;
        dataUint256[toBalanceKey] += _value;

        // add recipient to the token holder list
        string memory toTokenHolderIndexKey = __aa(_unit, _to, "tokenHolderIndex");
        string memory numHoldersKey = __a(_unit, "numTokenHolders");

        if (dataUint256[toTokenHolderIndexKey] == 0) {
            dataUint256[numHoldersKey] += 1;
            dataAddress[__ia(dataUint256[numHoldersKey], _unit, "tokenHolder")] = _to;
            dataUint256[toTokenHolderIndexKey] = dataUint256[numHoldersKey];
        }

        // if sender now has 0 balance then remove them from the token holder list
        if (dataUint256[fromBalanceKey] == 0 && dataUint256[__aa(_unit, _from, "tokenHolderIndex")] > 0) {
            _removeTokenHolder(_unit, _from);
        }
    }

    function _removeTokenHolder(address _unit, address _holder) private {
        uint256 idx = dataUint256[__aa(_unit, _holder, "tokenHolderIndex")];
        dataUint256[__aa(_unit, _holder, "tokenHolderIndex")] = 0;

        // fast delete: replace with item currently at end of list
        if (dataUint256[__a(_unit, "numTokenHolders")] > 1) {
            address lastHolder = dataAddress[__ia(dataUint256[__a(_unit, "numTokenHolders")], _unit, "tokenHolder")];
            dataAddress[__ia(idx, _unit, "tokenHolder")] = lastHolder;
            dataUint256[__aa(_unit, lastHolder, "tokenHolderIndex")] = idx;
        } else {
            dataAddress[__ia(idx, _unit, "tokenHolder")] = address(0);
        }

        dataUint256[__a(_unit, "numTokenHolders")] -= 1;
    }

    function _burn(
        address _unit,
        address _holder,
        uint256 _amount
    ) private {
        require(_amount > 0, "cannot burn zero");

        string memory k = __aa(_unit, _holder, "tokenBalance");
        require(dataUint256[k] >= _amount, "not enough balance to burn");
        dataUint256[k] = dataUint256[k] - _amount;

        if (dataUint256[k] == 0) {
            _removeTokenHolder(_unit, _holder);
        }

        dataUint256[__a(_unit, "tokenSupply")] -= _amount;
    }
    
}
