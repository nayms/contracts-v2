pragma solidity 0.6.12;

import '../base/IDiamondFacet.sol';
import '../base/IPolicyCoreFacet.sol';

contract DummyPolicyFacet is IDiamondFacet, IPolicyCoreFacet {
  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyCoreFacet.calculateMaxNumOfPremiums.selector
    );
  }

  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] calldata _premiums
  ) external override {}

  function markAsReadyForApproval () external override {}

  function getInfo () external view override  returns (
    address treasury_,
    uint256 initiationDate_,
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 premiumIntervalSeconds_,
    uint256 brokerCommissionBP_,
    uint256 claimsAdminCommissionBP_,
    uint256 naymsCommissionBP_,
    uint256 numTranches_,
    uint256 state_
  ) {}

  function getTranchInfo (uint256 _index) external view override returns (
    address token_,
    uint256 state_,
    uint256 numShares_,
    uint256 initialPricePerShare_,
    uint256 balance_,
    uint256 sharesSold_,
    uint256 initialSaleOfferId_,
    uint256 finalBuybackofferId_
  ) {}

  function checkAndUpdateState () external override {}

  function calculateMaxNumOfPremiums() external view override returns (uint256) {
    return 666;
  }

  function initiationDateHasPassed () external view override returns (bool) {
    return false;
  }

  function startDateHasPassed () external view override returns (bool) {
    return false;
  }

  function maturationDateHasPassed () external view override returns (bool) {
    return false;
  }
}
