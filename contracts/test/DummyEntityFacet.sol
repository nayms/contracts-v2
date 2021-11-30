// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../base/IDiamondFacet.sol';
import '../base/IEntityCoreFacet.sol';
import '../base/IEntityFundingFacet.sol';

contract DummyEntityFacet is IDiamondFacet, IEntityCoreFacet, IEntityFundingFacet {
  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityFundingFacet.getBalance.selector
    );
  }

  function getBalance(address /*_unit*/) public view override returns (uint256) {
    return 123;
  }

  function createPolicy(
    bytes32 _id,
    uint256[] calldata _typeAndDatesAndCommissionsBP,
    address[] calldata _unitAndTreasuryAndStakeholders,
    uint256[][] calldata _trancheData,
    bytes[] calldata _approvalSignatures
  ) external override {}

  function deposit(address _unit, uint256 _amount) external override {}
  function withdraw(address _unit, uint256 _amount) external override {}
  function payTranchePremium(address _policy, uint256 _trancheIndex, uint256 _amount) external override {}
  function trade(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount) external override returns (uint256) {}
  function sellAtBestPrice(address _sellUnit, uint256 _sellAmount, address _buyUnit) external override {}
}
