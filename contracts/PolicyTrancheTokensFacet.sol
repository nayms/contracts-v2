// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyTrancheTokensFacet.sol";
import "./base/IMarket.sol";
import "./base/IMarketObserver.sol";
import "./base/IMarketObserverDataTypes.sol";
import "./base/AccessControl.sol";
import "./base/Address.sol";
import "./base/Strings.sol";
import "./base/Uint.sol";
import "./base/IERC20.sol";
import "./PolicyFacetBase.sol";

/**
 * @dev Business-logic for Policy commissions
 */
contract PolicyTrancheTokensFacet is EternalStorage, Controller, IDiamondFacet, IPolicyTrancheTokensFacet, PolicyFacetBase, IMarketObserver, IMarketObserverDataTypes {
    using Uint for uint256;
    using Address for address;
    using Strings for string;

    /**
     * Constructor
     */
    constructor(address _settings) Controller(_settings) {
        // empty
    }

    // IDiamondFacet

    function getSelectors() public pure override returns (bytes memory) {
        return
            abi.encodePacked(
                IPolicyTrancheTokensFacet.tknName.selector,
                IPolicyTrancheTokensFacet.tknSymbol.selector,
                IPolicyTrancheTokensFacet.tknTotalSupply.selector,
                IPolicyTrancheTokensFacet.tknBalanceOf.selector,
                IPolicyTrancheTokensFacet.tknAllowance.selector,
                IPolicyTrancheTokensFacet.tknApprove.selector,
                IPolicyTrancheTokensFacet.tknTransfer.selector,
                IMarketObserver.handleTrade.selector,
                IMarketObserver.handleClosure.selector
            );
    }

    // IPolicyTrancheTokensFacet

    function tknName(uint256 _index) public view override returns (string memory) {
        return string(abi.encodePacked("NAYMS-", address(this).toString(), "-TRANCHE-", uint256(_index + 1).toString()));
    }

    function tknSymbol(uint256 _index) public view override returns (string memory) {
        // max len = 11 chars
        return string(abi.encodePacked("N-", address(this).toString().substring(6), "-", uint256(_index + 1).toString()));
    }

    function tknTotalSupply(uint256 _index) public view override returns (uint256) {
        return dataUint256[__i(_index, "numShares")];
    }

    function tknBalanceOf(uint256 _index, address _owner) public view override returns (uint256) {
        string memory k = __ia(_index, _owner, "balance");
        return dataUint256[k];
    }

    function tknAllowance(
        uint256 _index,
        address _spender,
        address _owner
    ) public view override returns (uint256) {
        string memory k = __iaa(_index, _owner, _spender, "allowance");
        return dataUint256[k];
    }

    function tknApprove(
        uint256, /*_index*/
        address _spender,
        address, /*_from*/
        uint256 /*_value*/
    ) public override {
        require(_spender == settings().getRootAddress(SETTING_MARKET), "only nayms market is allowed to transfer");
    }

    function tknTransfer(
        uint256 _index,
        address _spender,
        address _from,
        address _to,
        uint256 _value
    ) public override {
        require(_spender == settings().getRootAddress(SETTING_MARKET), "only nayms market is allowed to transfer");
        _transfer(_index, _from, _to, _value);
    }

    // Internal functions

    function _transfer(
        uint256 _index,
        address _from,
        address _to,
        uint256 _value
    ) private {
        // when token holder is sending to the market
        address market = settings().getRootAddress(SETTING_MARKET);

        // if this is a transfer to the market
        if (market == _to) {
            // and the sender is not the initial holder of the token
            address initialHolder = dataAddress[__i(_index, "initialHolder")];
            if (initialHolder != _from) {
                // then the sender must be a trader, in which case ony allow this if the policy is active
                require(dataUint256["state"] == POLICY_STATE_ACTIVE, "can only trade when policy is active");
            }
        }

        string memory fromKey = __ia(_index, _from, "balance");
        string memory toKey = __ia(_index, _to, "balance");

        require(dataUint256[fromKey] >= _value, "not enough balance");

        dataUint256[fromKey] = dataUint256[fromKey] - _value;
        dataUint256[toKey] = dataUint256[toKey] + _value;
    }

    function handleTrade(
        uint256 _offerId,
        uint256 _soldAmount,
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

        if (t == MODT_TRANCHE_SALE) {
            // get policy address and tranche id
            (, address policy, uint256 trancheId) = abi.decode(_data, (uint256, address, uint256));

            // if we created this offer
            if (policy == address(this)) {
                // if we are in the initial sale period
                if (dataUint256[__i(trancheId, "state")] == TRANCHE_STATE_SELLING) {
                    // check tranche token matches sell token
                    IMarketDataFacet.OfferState memory offerState = _getMarket().getOffer(_offerId);
                    // (, address sellToken, , , , , , , , , ,) = _getMarket().getOffer(_offerId);
                    address trancheAddress = dataAddress[__i(trancheId, "address")];
                    require(trancheAddress == offerState.sellToken, "sell token must be tranche token");
                    // record how many "shares" were sold
                    dataUint256[__i(trancheId, "sharesSold")] = dataUint256[__i(trancheId, "sharesSold")] + _soldAmount;
                    // update tranche balance
                    dataUint256[__i(trancheId, "balance")] = dataUint256[__i(trancheId, "balance")] + _boughtAmount;
                    // tell treasury to add tranche balance value to overall policy balance
                    _getTreasury().incPolicyBalance(_boughtAmount);
                    // if the tranche has fully sold out
                    if (dataUint256[__i(trancheId, "sharesSold")] == dataUint256[__i(trancheId, "numShares")]) {
                        // flip tranche state to ACTIVE
                        _setTrancheState(trancheId, TRANCHE_STATE_ACTIVE);
                    }
                }
            }
        }
    }

    function handleClosure(
        uint256 _offerId,
        uint256, /*_unsoldAmount*/
        uint256, /*_unboughtAmount*/
        bytes memory _data
    ) external override {
        if (_data.length == 0) {
            return;
        }

        // get data type
        uint256 t = abi.decode(_data, (uint256));

        // if it's a tranche token buyback trade
        if (t == MODT_TRANCHE_BUYBACK) {
            // get policy address and tranche id
            (, address policy, uint256 trancheId) = abi.decode(_data, (uint256, address, uint256));

            // if we created this offer
            if (policy == address(this)) {
                // if we are in the policy buyback state
                if (dataUint256["state"] == POLICY_STATE_BUYBACK) {
                    // check tranche token matches buy token
                    IMarketDataFacet.OfferState memory offerState = _getMarket().getOffer(_offerId);
                    // (, , , , address buyToken, , , , , , ,) = _getMarket().getOffer(_offerId);
                    address trancheAddress = dataAddress[__i(trancheId, "address")];
                    require(trancheAddress == offerState.buyToken, "buy token must be tranche token");

                    // NOTE: we're assuming that an order never gets closed until it is sold out
                    // Sold out = only <=dusk amount remaining (see market for dusk level)

                    // mark buyback as complete
                    dataBool[__i(trancheId, "buybackCompleted")] = true;
                    dataUint256["numTranchesBoughtBack"] += 1;

                    // if all tranches have been bought back
                    if (dataUint256["numTranchesBoughtBack"] == dataUint256["numTranches"]) {
                        // policy is now "closed"
                        _setPolicyState(POLICY_STATE_CLOSED);
                    }
                }
            }
        }
    }

    function _getMarket() internal view returns (IMarket) {
        return IMarket(settings().getRootAddress(SETTING_MARKET));
    }
}
