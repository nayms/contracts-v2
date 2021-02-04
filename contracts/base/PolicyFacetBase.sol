pragma solidity >=0.6.7;

import "./EternalStorage.sol";
import "./IPolicyStates.sol";
import "./AccessControl.sol";

/**
 * @dev Policy facet base class
 */
abstract contract PolicyFacetBase is EternalStorage, IPolicyStates, AccessControl {
  modifier assertIsEntityRep(address _user, address _entity) {
    bytes32 ctx = AccessControl(_entity).aclContext();
    require(hasRoleWithContext(ctx, _user, ROLE_ENTITY_REP), 'must be entity rep');
    _;
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
