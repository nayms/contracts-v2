// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyClaimsFacet.sol";
import "./base/IPolicyCoreFacet.sol";
import ".//PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";
import "./base/ReentrancyGuard.sol";

/**
 * @dev Business-logic for Policy claims
 */
contract PolicyClaimsFacet is EternalStorage, Controller, IDiamondFacet, IPolicyClaimsFacet, PolicyFacetBase, ReentrancyGuard {

  modifier assertActiveState () {
    require(dataUint256["state"] == POLICY_STATE_ACTIVE, 'must be in active state');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyClaimsFacet.makeClaim.selector,
      IPolicyClaimsFacet.approveClaim.selector,
      IPolicyClaimsFacet.disputeClaim.selector,
      IPolicyClaimsFacet.acknowledgeClaim.selector,
      IPolicyClaimsFacet.declineClaim.selector,
      IPolicyClaimsFacet.payClaim.selector,
      IPolicyClaimsFacet.getClaimStats.selector,
      IPolicyClaimsFacet.getClaimInfo.selector
    );
  }

  // IPolicyClaimsFacet

  function getClaimStats() public view override returns (
    uint256 numClaims_,
    uint256 numPendingClaims_
  ) {
    numClaims_ = dataUint256["claimsCount"];
    numPendingClaims_ = dataUint256["claimsPendingCount"];
  }

  function getClaimInfo (uint256 _claimIndex) public view override returns (
    uint256 amount_,
    uint256 trancheIndex_,
    uint256 state_,
    bool disputed_,
    bool acknowledged_
  ) {
    trancheIndex_ = dataUint256[__i(_claimIndex, "claimTranche")];
    amount_ = dataUint256[__i(_claimIndex, "claimAmount")];
    state_ = dataUint256[__i(_claimIndex, "claimState")];
    disputed_ = dataBool[__i(_claimIndex, "claimDisputed")];
    acknowledged_ = dataBool[__i(_claimIndex, "claimAcknowledged")];
  }

  function makeClaim(uint256 _trancheIndex, uint256 _amount) external override 
    assertActiveState
    assertBelongsToEntityWithRole(msg.sender, ROLE_INSURED_PARTY)
  {
    IPolicyCoreFacet(address(this)).checkAndUpdateState();
    address entity = _getEntityWithRole(ROLE_INSURED_PARTY);

    // check that tranche is active
    require(dataUint256[__i(_trancheIndex, "state")] == TRANCHE_STATE_ACTIVE, 'tranche must be active');

    // check amount
    require(
      _getTranchePendingClaimsAmount(_trancheIndex) + _amount <= dataUint256[string(abi.encodePacked(_trancheIndex, "balance"))],
      'claim too high'
    );

    uint256 claimIndex = dataUint256["claimsCount"];
    dataUint256[__i(claimIndex, "claimAmount")] = _amount;
    dataUint256[__i(claimIndex, "claimTranche")] = _trancheIndex;
    dataAddress[__i(claimIndex, "claimEntity")] = entity;
    dataUint256[__i(claimIndex, "claimState")] = CLAIM_STATE_CREATED;

    dataUint256["claimsCount"] = claimIndex + 1;
    dataUint256["claimsPendingCount"] += 1;

    emit NewClaim(_trancheIndex, claimIndex, msg.sender);
  }

  function disputeClaim(uint256 _claimIndex) 
    external 
    override
    assertBelongsToEntityWithRole(msg.sender, ROLE_UNDERWRITER)
  {
    require(0 < dataUint256[__i(_claimIndex, "claimAmount")], 'invalid claim');
    uint256 state = dataUint256[__i(_claimIndex, "claimState")];
    require(state == CLAIM_STATE_CREATED, 'in wrong state');
    dataBool[__i(_claimIndex, "claimDisputed")] = true;
    emit ClaimDisputed(_claimIndex, msg.sender);
  }

  function acknowledgeClaim(uint256 _claimIndex) 
    external 
    override
    assertBelongsToEntityWithRole(msg.sender, ROLE_UNDERWRITER)
  {
    require(0 < dataUint256[__i(_claimIndex, "claimAmount")], 'invalid claim');
    uint256 state = dataUint256[__i(_claimIndex, "claimState")];
    require(state == CLAIM_STATE_CREATED, 'in wrong state');
    dataBool[__i(_claimIndex, "claimAcknowledged")] = true;
    emit ClaimAcknowledged(_claimIndex, msg.sender);
  }

  function approveClaim(uint256 _claimIndex)
    external
    override
    assertBelongsToEntityWithRole(msg.sender, ROLE_CLAIMS_ADMIN)
  {
    // check claim
    require(0 < dataUint256[__i(_claimIndex, "claimAmount")], 'invalid claim');
    uint256 state = dataUint256[__i(_claimIndex, "claimState")];
    require(state == CLAIM_STATE_CREATED, 'in wrong state');

    // remove from tranche balance
    uint256 claimAmount = dataUint256[__i(_claimIndex, "claimAmount")];
    uint256 claimTranche = dataUint256[__i(_claimIndex, "claimTranche")];
    dataUint256[__i(claimTranche, "balance")] = dataUint256[__i(claimTranche, "balance")] - claimAmount;

    // update pending count
    dataUint256["claimsPendingCount"] -= 1;

    _setClaimState(_claimIndex, CLAIM_STATE_APPROVED);
  }


  function declineClaim(uint256 _claimIndex)
    external
    override
    assertBelongsToEntityWithRole(msg.sender, ROLE_CLAIMS_ADMIN)
  {
    // check claim
    require(0 < dataUint256[__i(_claimIndex, "claimAmount")], 'invalid claim');
    uint256 state = dataUint256[__i(_claimIndex, "claimState")];
    require(state == CLAIM_STATE_CREATED, 'in wrong state');

    // update pending count
    dataUint256["claimsPendingCount"] -= 1;

    _setClaimState(_claimIndex, CLAIM_STATE_DECLINED);
  }


  function payClaim(uint256 _claimIndex)
    external
    override
    nonReentrant
    assertBelongsToEntityWithRole(msg.sender, ROLE_CLAIMS_ADMIN)
  {
    // check claim
    require(0 < dataUint256[__i(_claimIndex, "claimAmount")], 'invalid claim');
    uint256 state = dataUint256[__i(_claimIndex, "claimState")];
    require(state == CLAIM_STATE_APPROVED, 'not approved');

    // check that premiums are fully paid
    require(
      _tranchePaymentsAllMade(dataUint256[__i(_claimIndex, "claimTranche")]), 
      'not possible until premiums are fully paid'
    );

    // transfer
    _getTreasury().payClaim(
      dataAddress[__i(_claimIndex, "claimEntity")], 
      dataUint256[__i(_claimIndex, "claimAmount")]
    );

    _setClaimState(_claimIndex, CLAIM_STATE_PAID);
  }

  // Internal methods

  function _setClaimState(uint256 _claimIndex, uint256 _newState) private {
    if (dataUint256[__i(_claimIndex, "claimState")] != _newState) {
      dataUint256[__i(_claimIndex, "claimState")] = _newState;
      emit ClaimStateUpdated(_claimIndex, _newState, msg.sender);
    }
  }

  function _getTranchePendingClaimsAmount (uint256 _index) private view returns (uint256) {
    uint256 amount;

    for (uint256 i = 0; i < dataUint256["claimsCount"]; i += 1) {
      uint256 state = dataUint256[__i(i, "claimState")];
      bool isPending = (state == CLAIM_STATE_CREATED);
      uint256 trancheNum = dataUint256[__i(i, "claimTranche")];

      if (trancheNum == _index && isPending) {
        amount = amount + dataUint256[__i(i, "claimAmount")];
      }
    }

    return amount;
  }
}
