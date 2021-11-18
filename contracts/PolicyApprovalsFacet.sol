// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/ECDSA.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyApprovalsFacet.sol";
import "./base/IPolicyCoreFacet.sol";
import ".//PolicyFacetBase.sol";

/**
 * @dev Business-logic for Policy approvals
 */
contract PolicyApprovalsFacet is EternalStorage, Controller, IDiamondFacet, IPolicyApprovalsFacet, PolicyFacetBase {
  using ECDSA for bytes32;
  
  modifier assertInApprovableState () {
    require(dataUint256["state"] == POLICY_STATE_IN_APPROVAL || dataUint256["state"] == POLICY_STATE_READY_FOR_APPROVAL, 'must be in approvable state');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyApprovalsFacet.approve.selector,
      IPolicyApprovalsFacet.getApprovalsInfo.selector
    );
  }

  // IPolicyApprovalsFacet

  function bulkApprove(bytes[] calldata _sigs) external override {
    bytes32 h = IPolicyCoreFacet(address(this)).getHash();

    bytes32[] memory roles = [
      ROLE_PENDING_UNDERWRITER,
      ROLE_PENDING_BROKER,
      ROLE_PENDING_INSURED_PARTY,
      ROLE_PENDING_CLAIMS_ADMIN
    ];

    for (uint i = 0; i < roles.length; i += 1) {
      _approve(
        roles[i], 
        keccack256(h).toEthSignedMessageHash().recover(_sigs[i])
      );
    }

    emit BulkApproved(msg.sender);
  }

  function approve (bytes32 _role) external override 
    assertInApprovableState
  {
    _approve(_role, msg.sender);
    emit Approved(msg.sender, newRole);
  }


  function getApprovalsInfo () public view override returns (
    bool approved_,
    bool insuredPartyApproved_,
    bool underwriterApproved_,
    bool brokerApproved_,
    bool claimsAdminApproved_
  ) {
    approved_ = _isFullyApproved();
    insuredPartyApproved_ = dataBool["insuredPartyApproved"];
    underwriterApproved_ = dataBool["underwriterApproved"];
    brokerApproved_ = dataBool["brokerApproved"];
    claimsAdminApproved_ = dataBool["claimsAdminApproved"];
  }

  // Internal methods

  function _approve (bytes32 _role, address _approver) private 
    assertBelongsToEntityWithRole(_approver, _role)
  {
    address entity = _getEntityWithRole(_role);

    bytes32 newRole;

    // replace pending role with non-pending version
    if (_role == ROLE_PENDING_UNDERWRITER) {
      newRole = ROLE_UNDERWRITER;
      dataBool["underwriterApproved"] = true;
    } else if (_role == ROLE_PENDING_BROKER) {
      newRole = ROLE_BROKER;
      dataBool["brokerApproved"] = true;
    } else if (_role == ROLE_PENDING_INSURED_PARTY) {
      newRole = ROLE_INSURED_PARTY;
      dataBool["insuredPartyApproved"] = true;
    } else if (_role == ROLE_PENDING_CLAIMS_ADMIN) {
      newRole = ROLE_CLAIMS_ADMIN;
      dataBool["claimsAdminApproved"] = true;
    }

    acl().unassignRole(aclContext(), entity, _role);    
    acl().assignRole(aclContext(), entity, newRole);    

    // update state
    if (_isFullyApproved()) {
      _setPolicyState(POLICY_STATE_APPROVED);
    } else {
      _setPolicyState(POLICY_STATE_IN_APPROVAL);
    }
  }

  function _isFullyApproved () private view returns (bool) {
    uint256 numApprovals = dataBool["underwriterApproved"] ? 1 : 0;
    numApprovals += dataBool["insuredPartyApproved"] ? 1 : 0;
    numApprovals += dataBool["brokerApproved"] ? 1 : 0;
    numApprovals += dataBool["claimsAdminApproved"] ? 1 : 0;
    return numApprovals == 4;
  }
}
