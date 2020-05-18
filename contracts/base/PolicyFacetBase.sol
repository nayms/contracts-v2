pragma solidity >=0.6.7;

import "./EternalStorage.sol";

/**
 * @dev Policy facet base class
 */
abstract contract PolicyFacetBase is EternalStorage {
  /**
   * @dev State: The policy has just been created.
   */
  uint256 constant public POLICY_STATE_CREATED = 0;
  /**
   * @dev State: The policy initial sale is in progress.
   */
  uint256 constant public POLICY_STATE_SELLING = 1;
  /**
   * @dev State: The policy initial sale has completed and it is now active.
   */
  uint256 constant public POLICY_STATE_ACTIVE = 2;
  /**
   * @dev State: The policy has matured.
   */
  uint256 constant public POLICY_STATE_MATURED = 3;

  /**
   * @dev State: The tranch has just been created.
   */
  uint256 constant public TRANCH_STATE_CREATED = 0;
  /**
   * @dev State: The tranch initial sale is in progress.
   */
  uint256 constant public TRANCH_STATE_SELLING = 1;
  /**
   * @dev State: The tranch initial sale has completed it is now active.
   */
  uint256 constant public TRANCH_STATE_ACTIVE = 2;
  /**
   * @dev State: The tranch has matured.
   */
  uint256 constant public TRANCH_STATE_MATURED = 3;
  /**
   * @dev State: The tranch has been cancelled.
   */
  uint256 constant public TRANCH_STATE_CANCELLED = 4;

  // methods

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

  // events

  event PolicyStateUpdated (uint256 indexed state, address indexed caller);
  event TranchStateUpdated (uint256 indexed tranchIndex, uint256 indexed state, address indexed caller);
}
