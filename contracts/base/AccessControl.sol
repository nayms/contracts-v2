pragma solidity >=0.5.8;

import "./Address.sol";
import "./EternalStorage.sol";
import "./IACL.sol";

contract AccessControl is EternalStorage {
  using Address for address;

  // keccak256("roleEntityAdmin");
  bytes32 constant public ROLE_ENTITY_ADMIN = 0x2bb88364d2ea1a59005ea18e1b13006461dd300582dd99ab2c7cb5b45084031f;
  // keccak256("roleEntityManager");
  bytes32 constant public ROLE_ENTITY_MANAGER = 0x3a16028c56841a89575c1d88f68b86697854d2e24484155ef33bc060809583f7;
  // keccak256("roleEntityRepresentative");
  bytes32 constant public ROLE_ENTITY_REPRESENTATIVE = 0x13d6dcf953706cc0dc03459258218dee3c365e8df399b3f3c28a524285320aca;

  // keccak256("roleAssetManager");
  bytes32 constant public ROLE_ASSET_MANAGER = 0x15fe38e1f43516cc4ffb9ea5c938aa92b47ad6c3630aa8f3ab30adefc9305ee9;
  // keccak256("roleClientManager");
  bytes32 constant public ROLE_CLIENT_MANAGER = 0xe6633b919e32633b20851f7ea00f45dc49a8d19e72c7ef293713007df9d9844c;

  // keccak256("rolegroupManageEntity");
  bytes32 constant public ROLEGROUP_MANAGE_ENTITY = 0xff0694dd694cf6c0a8b52be4357009d9daf0f6264f0e93dc90cfb6d65ba9412b;
  // keccak256("rolegroupManagePolicy");
  bytes32 constant public ROLEGROUP_MANAGE_POLICY = 0xf78c928c58f3d8ccb8f62e4e3ee38646b289ba066ffe8ab01409fb28be928927;
  // keccak256("rolegroupApprovePolicy");
  bytes32 constant public ROLEGROUP_APPROVE_POLICY = 0x4b77fccf27a3185c9dbf5072d460f22f940bb947b4e66f7e8f8be48b7f9f7473;

  constructor (address _acl) public {
    dataAddress["acl"] = _acl;
    dataString["aclContext"] = address(this).toString();
  }

  modifier assertIsAdmin () {
    require(acl().isAdmin(msg.sender), 'must be admin');
    _;
  }

  modifier assertInRoleGroup (bytes32 _roleGroup) {
    require(inRoleGroup(msg.sender, _roleGroup), 'must be in role group');
    _;
  }

  function inRoleGroup (address _addr, bytes32 _roleGroup) public view returns (bool) {
    return inRoleGroupWithContext(aclContext(), _addr, _roleGroup);
  }

  function hasRole (address _addr, bytes32 _role) public view returns (bool) {
    return hasRoleWithContext(aclContext(), _addr, _role);
  }

  function inRoleGroupWithContext (string memory _ctx, address _addr, bytes32 _roleGroup) public view returns (bool) {
    return acl().hasRoleInGroup(_ctx, _addr, _roleGroup);
  }

  function hasRoleWithContext (string memory _ctx, address _addr, bytes32 _role) public view returns (bool) {
    return acl().hasRole(_ctx, _addr, _role);
  }

  function acl () internal view returns (IACL) {
    return IACL(dataAddress["acl"]);
  }

  function aclContext () public view returns (string memory) {
    return dataString["aclContext"];
  }
}
