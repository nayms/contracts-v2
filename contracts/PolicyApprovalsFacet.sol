pragma solidity >=0.6.7;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyApprovalsFacet.sol";
import "./base/PolicyFacetBase.sol";

/**
 * @dev Business-logic for Policy approvals
 */
contract PolicyApprovalsFacet is EternalStorage, Controller, IDiamondFacet, IPolicyApprovalsFacet, PolicyFacetBase {
  modifier assertInApprovableState () {
    require(dataUint256["state"] == POLICY_STATE_IN_APPROVAL || dataUint256["state"] == POLICY_STATE_CREATED, 'must be in approvable state');
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

  function approve (address _entity) public override 
    assertInApprovableState
    assertIsEntityRep(msg.sender, _entity)
  {
    bytes32 role;

    if (hasRole(_entity, ROLE_PENDING_UNDERWRITER)) {
      role = ROLE_UNDERWRITER;
      _switchRole(_entity, ROLE_PENDING_UNDERWRITER, role);
      dataBool["underwriterApproved"] = true;
    } else if (hasRole(_entity, ROLE_PENDING_BROKER)) {
      role = ROLE_BROKER;
      _switchRole(_entity, ROLE_PENDING_BROKER, role);
      dataBool["brokerApproved"] = true;
    } else if (hasRole(_entity, ROLE_PENDING_INSURED_PARTY)) {
      role = ROLE_INSURED_PARTY;
      _switchRole(_entity, ROLE_PENDING_INSURED_PARTY, role);
      dataBool["insuredPartyApproved"] = true;
    } else if (hasRole(_entity, ROLE_PENDING_CLAIMS_ADMIN)) {
      role = ROLE_CLAIMS_ADMIN;
      _switchRole(_entity, ROLE_PENDING_CLAIMS_ADMIN, role);
      dataBool["claimsAdminApproved"] = true;
    } else {
      revert('caller does not have right role');
    }

    // update state
    if (_isFullyApproved()) {
      _setPolicyState(POLICY_STATE_INITIATED);
    } else {
      _setPolicyState(POLICY_STATE_IN_APPROVAL);
    }

    emit Approved(msg.sender, role);
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

  function _isFullyApproved () private view returns (bool) {
    uint256 numApprovals = dataBool["underwriterApproved"] ? 1 : 0;
    numApprovals += dataBool["insuredPartyApproved"] ? 1 : 0;
    numApprovals += dataBool["brokerApproved"] ? 1 : 0;
    numApprovals += dataBool["claimsAdminApproved"] ? 1 : 0;
    return numApprovals == 4;
  }

  function _switchRole (address _addr, bytes32 _oldRole, bytes32 _newRole) private {
    acl().assignRole(aclContext(), _addr, _newRole);    
    acl().unassignRole(aclContext(), _addr, _oldRole);    
  }
}
