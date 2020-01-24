pragma solidity >=0.5.8;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityImpl.sol";
import "./Policy.sol";

/**
 * @dev Business-logic for Entity
 */
 contract EntityImpl is EternalStorage, Controller, IEntityImpl, IProxyImpl {
  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {
    // empty
  }

  // IProxyImpl

  function getImplementationVersion () public pure returns (string memory) {
    return "v1";
  }


  // IEntityImpl

  function createPolicy(
    address _impl,
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds
  )
    public
    assertInRoleGroup(ROLEGROUP_MANAGE_POLICY)
  {
    Policy f = new Policy(
      address(acl()),
      address(settings()),
      aclContext(),
      _impl,
      _initiationDate,
      _startDate,
      _maturationDate,
      _unit,
      _premiumIntervalSeconds
    );

    uint256 numPolicies = dataUint256["numPolicies"];
    dataAddress[string(abi.encodePacked("policy", numPolicies))] = address(f);
    dataUint256["numPolicies"] = numPolicies + 1;

    emit NewPolicy(address(f), address(this), msg.sender);
  }


  function getNumPolicies() public view returns (uint256) {
    return dataUint256["numPolicies"];
  }

  function getPolicy(uint256 _index) public view returns (address) {
    return dataAddress[string(abi.encodePacked("policy", _index))];
  }
}
