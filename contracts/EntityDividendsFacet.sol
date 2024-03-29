// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityDividendsFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/Strings.sol";
import "./EntityFacetBase.sol";
import "./EntityToken.sol";

contract EntityDividendsFacet is EternalStorage, Controller, EntityFacetBase, IEntityDividendsFacet, IDiamondFacet {
    using Strings for string;

    /**
     * Constructor
     */
    constructor(address _settings) Controller(_settings) {}

    // IDiamondFacet

    function getSelectors() public pure override returns (bytes memory) {
        return
            abi.encodePacked(
                IEntityDividendsFacet.getNumTokenHolders.selector,
                IEntityDividendsFacet.getTokenHolderAtIndex.selector,
                IEntityDividendsFacet.payDividend.selector,
                IEntityDividendsFacet.getWithdrawableDividend.selector,
                IEntityDividendsFacet.withdrawDividend.selector
            );
    }

    // IEntityDividendsFacet

    function getNumTokenHolders(address _unit) external view override returns (uint256) {
        return dataUint256[__a(_unit, "numTokenHolders")];
    }

    function getTokenHolderAtIndex(address _unit, uint256 _index) external view override returns (address) {
        return dataAddress[__ia(_index, _unit, "tokenHolder")];
    }

    function payDividend(address _unit, uint256 _amount) external override {
        // if a sale is in progress then some tokens are hold by market on behalf of entity
        // - let's wait until tokens have been allocated to holder
        _assertNoTokenSaleInProgress(_unit);

        _assertHasEnoughBalance(_unit, _amount);

        uint256 supply = dataUint256[__a(_unit, "tokenSupply")];
        uint256 numHolders = dataUint256[__a(_unit, "numTokenHolders")];
        uint256 entityBal = dataUint256[__a(_unit, "balance")];

        for (uint256 i = 1; numHolders >= i; i += 1) {
            // get user and balance
            address a = dataAddress[__ia(i, _unit, "tokenHolder")];
            uint256 bal = dataUint256[__aa(_unit, a, "tokenBalance")];
            // calculate dividend
            uint256 div = (bal * _amount) / supply;
            // transfer
            entityBal = entityBal - div;
            string memory divKey = __iaa(0, a, _unit, "dividend");
            dataUint256[divKey] = dataUint256[divKey] + div;
        }

        dataUint256[__a(_unit, "balance")] = entityBal;
    }

    function getWithdrawableDividend(address _unit, address _holder) external view override returns (uint256) {
        string memory divKey = __iaa(0, _holder, _unit, "dividend");
        return dataUint256[divKey];
    }

    function withdrawDividend(address _unit) external override {
        string memory divKey = __iaa(0, msg.sender, _unit, "dividend");

        uint256 div = dataUint256[divKey];

        if (div > 0) {
            dataUint256[divKey] = 0;
            IERC20(_unit).transfer(msg.sender, div);
        }
    }
}
