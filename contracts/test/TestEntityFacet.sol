pragma solidity >=0.6.7;

import '../base/IDiamondFacet.sol';
import '../base/IEntityCoreFacet.sol';

contract TestEntityFacet is IDiamondFacet, IEntityCoreFacet {
  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityCoreFacet.getNumPolicies.selector
    );
  }

  function getNumPolicies() public view override returns (uint256) {
    return 666;
  }

  function getPolicy(uint256 /*_index*/) external view override returns (address) {
    return address(this);
  }

  function createPolicy(
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256 _brokerCommissionBP,
    uint256 _assetManagerCommissionBP,
    uint256 _naymsCommissionBP
  ) external override {}
  function deposit(address _unit, uint256 _amount) external override {}
  function withdraw(address _unit, uint256 _amount) external override {}
  function payTranchPremium(address _policy, uint256 _tranchIndex) external override {}
  function trade(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount) external override {}
  function sellAtBestPrice(address _sellUnit, uint256 _sellAmount, address _buyUnit) external override {}
}
