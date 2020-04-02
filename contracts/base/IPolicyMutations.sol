pragma solidity >=0.5.8;

interface IPolicyMutations {
  function makeClaim (uint256 _index, address _clientManagerEntity, uint256 _amount) external;
  function approveClaim (uint256 _claimIndex) external;
  function declineClaim (uint256 _claimIndex) external;
  function payClaims() external;
  function payCommissions (
    address _assetManagerEntity, address _assetManager,
    address _brokerEntity, address _broker
  ) external;

  event NewClaim(uint256 indexed tranchIndex, uint256 indexed claimIndex, address indexed caller);
  event ClaimApproved(uint256 indexed tranchIndex, uint256 indexed claimIndex, address indexed caller);
  event ClaimDeclined(uint256 indexed tranchIndex, uint256 indexed claimIndex, address indexed caller);
  event PaidClaims(address indexed caller);
  event PaidCommissions(address indexed assetManagerEntity, address indexed brokerEntity, address indexed caller);
}
