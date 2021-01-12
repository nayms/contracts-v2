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

  function approve () public override 
    assertInApprovableState
  {
    bytes32 role;

    if (inRoleGroup(msg.sender, ROLEGROUP_CAPITAL_PROVIDERS)) {
      role = ROLE_CAPITAL_PROVIDER;
      dataBool["capitalProviderApproved"] = true;
    } else if (inRoleGroup(msg.sender, ROLEGROUP_INSURED_PARTYS)) {
      role = ROLE_INSURED_PARTY;
      dataBool["insuredPartyApproved"] = true;
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
    bool capitalProviderApproved_
  ) {
    approved_ = _isFullyApproved();
    insuredPartyApproved_ = dataBool["insuredPartyApproved"];
    capitalProviderApproved_ = dataBool["capitalProviderApproved"];
  }

  // Internal methods

  function _isFullyApproved () private view returns (bool) {
    uint256 numApprovals = dataBool["capitalProviderApproved"] ? 1 : 0;
    numApprovals += dataBool["insuredPartyApproved"] ? 1 : 0;
    return numApprovals == 2;
  }
}
