// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "forge-std/Script.sol";
import "../contracts/base/IACL.sol";
import "../contracts/base/IACLConstants.sol";
import "../contracts/base/IEntity.sol";
import "../contracts/base/IEntityDeployer.sol";

contract StartTokenSale is Script, IACLConstants {
    // Contract addressess
    address constant ACL = 0xCAd2199A40F4b6e6B177Cb09D23fcA97f7d90295;
    address constant ENTITY_DEPLOYER = 0xC6f7f6C00324919C28f5351A605930b3150c63Ec;
    address constant ENTITY1 = 0xFA8D5E190f2AaE0d9870CEAAdCA657e031388ecF;
    address constant LOVETOKEN = 0x1Ac000521C2A12DfE91fFce4b7047d56B81E1572;

    IACL acl = IACL(ACL);
    IEntity entity1 = IEntity(ENTITY1);
    IEntityDeployer entityDeployer = IEntityDeployer(ENTITY_DEPLOYER);

    function run() external returns (address entityAddress) {
        vm.startBroadcast();

        bytes32 systemContext = keccak256(abi.encodePacked(address(ACL)));
        // bytes32 systemContext = acl.systemContext();

        acl.assignRole(systemContext, msg.sender, ROLE_SYSTEM_MANAGER);

        entityAddress = entityDeployer.getChild(1);

        // address newSystemManager = ENTITY1;
        // acl.assignRole(entity1.aclContext(), newSystemManager, ROLE_SYSTEM_MANAGER);
        // acl.assignRole(entity1.aclContext(), entityManager, ROLE_ENTITY_MANAGER);

        // // amount to mint
        // // underlying token address
        // // price of underlying
        entity1.startTokenSale(1e18, LOVETOKEN, 1e18);
    }
}
