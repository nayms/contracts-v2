pragma solidity >=0.5.8;

contract IPolicyStates {
  uint256 constant public POLICY_STATE_CREATED = 0;
  uint256 constant public POLICY_STATE_SELLING = 1;
  uint256 constant public POLICY_STATE_ACTIVE = 2;
  uint256 constant public POLICY_STATE_MATURED = 3;

  uint256 constant public TRANCH_STATE_CREATED = 0;
  uint256 constant public TRANCH_STATE_SELLING = 1;
  uint256 constant public TRANCH_STATE_ACTIVE = 2;
  uint256 constant public TRANCH_STATE_MATURED = 3;
  uint256 constant public TRANCH_STATE_CANCELLED = 4;
}