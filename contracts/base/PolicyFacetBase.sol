pragma solidity >=0.6.7;

import "./EternalStorage.sol";
import "./IPolicyStates.sol";
import "./AccessControl.sol";

/**
 * @dev Policy facet base class
 */
abstract contract PolicyFacetBase is EternalStorage, IPolicyStates, AccessControl {
  modifier assertBelongsToEntityWithRole(address _user, bytes32 _role) {
    address entity = _getEntityWithRole(_role);
    // check they are a rep
    bytes32 ctx = AccessControl(entity).aclContext();
    require(hasRoleWithContext(ctx, _user, ROLE_ENTITY_REP), 'not a rep of associated entity');
    _;
  }

  function _getEntityWithRole (bytes32 _role) internal view returns (address) {
    address[] memory entities = acl().getUsersForRole(aclContext(), _role);
    return entities[0];
  }

  function _setPolicyState (uint256 _newState) internal {
    if (dataUint256["state"] != _newState) {
      dataUint256["state"] = _newState;
      emit PolicyStateUpdated(_newState, msg.sender);
    }
  }

  function _setTranchState (uint256 _tranchIndex, uint256 _newState) internal {
    if (dataUint256[__i(_tranchIndex, "state")] != _newState) {
      dataUint256[__i(_tranchIndex, "state")] = _newState;
      emit TranchStateUpdated(_tranchIndex, _newState, msg.sender);
    }
  }
}
