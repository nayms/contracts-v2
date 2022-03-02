// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IEntitySimplePolicyDataFacet.sol";
import "./base/ISimplePolicy.sol";

contract EntitySimplePolicyDataFacet is Controller, IDiamondFacet, IEntitySimplePolicyDataFacet {

  constructor (address _settings) Controller(_settings) public { }

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntitySimplePolicyDataFacet.allowSimplePolicy.selector,
      IEntitySimplePolicyDataFacet.getNumSimplePolicies.selector,
      IEntitySimplePolicyDataFacet.getPremiumsAndClaimsPaid.selector,
      IEntitySimplePolicyDataFacet.getEnabledCurrency.selector
    );
  }

  function allowSimplePolicy() external override view returns (bool _allow) {
    return dataBool["allowSimplePolicy"];
  }

  function getNumSimplePolicies() external override view returns (uint256 _numPolicies) {
    return dataUint256["numSimplePolicies"];
  }

  function getPremiumsAndClaimsPaid(bytes32 _id) external view override returns(uint256 premiumsPaid_, uint256 claimsPaid_) {
    ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "simplePolicyAddress")]);
    address unit;
    (, , unit, , ) = policy.getSimplePolicyInfo();

    premiumsPaid_ = dataUint256[__a(unit, "premiumsPaid")];
    claimsPaid_ = dataUint256[__a(unit, "claimsPaid")];
  }

  function getEnabledCurrencies() external override view returns (address[] memory) {
    return dataManyAddresses["enabledUnits"];
  }

  function getEnabledCurrency(address _unit)
    external override view
    returns (uint256 _collateralRatio, uint256 _maxCapital)
  {
    _collateralRatio = dataUint256[__a(_unit, "collateralRatio")];
    _maxCapital = dataUint256[__a(_unit, "maxCapital")];
  }

}
