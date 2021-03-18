pragma solidity >=0.6.7;

import "./EternalStorage.sol";
import "./IPolicyStates.sol";
import "./IPolicyTreasury.sol";
import "./AccessControl.sol";

/**
 * @dev Policy facet base class
 */
abstract contract PolicyFacetBase is EternalStorage, IPolicyStates, AccessControl {
  modifier assertBelongsToEntityWithRole(address _user, bytes32 _role) {
    require(_belongsToEntityWithRole(_user, _role), 'not a rep of associated entity');
    _;
  }

  function _belongsToEntityWithRole (address _user, bytes32 _role) internal view returns (bool) {
    address entity = _getEntityWithRole(_role);
    return _isRepOfEntity(_user, entity);
  }

  function _getEntityWithRole (bytes32 _role) internal view returns (address) {
    address[] memory entities = acl().getUsersForRole(aclContext(), _role);
    require (entities.length > 0, 'no entity with role');
    return entities[0];
  }

  function _isRepOfEntity (address _user, address _entity) internal view returns (bool) {
    // check they are a rep
    bytes32 ctx = AccessControl(_entity).aclContext();
    return inRoleGroupWithContext(ctx, _user, ROLEGROUP_ENTITY_REPS);
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

  function _getTreasury () internal view returns (IPolicyTreasury) {
    return IPolicyTreasury(dataAddress["treasury"]);
  }
}
