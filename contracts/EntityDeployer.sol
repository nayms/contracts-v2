// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/EternalStorage.sol";
import "./base/Destructible.sol";
import "./base/IEntityDeployer.sol";
import "./base/Parent.sol";
import "./Entity.sol";

/**
 * This is responsible for deploying a new Entity.
 */
contract EntityDeployer is EternalStorage, Destructible, IEntityDeployer, Parent {
    modifier assertCanCreateEntity() {
        require(isAdmin(msg.sender) || inRoleGroup(msg.sender, ROLEGROUP_SYSTEM_MANAGERS), "must be system manager");
        _;
    }

    /**
     * Constructor
     */
    constructor(address _settings) Destructible(_settings) {
        // empty
    }

    /**
     * @dev Deploy a new Entity.
     */
    function deploy(address _entityAdmin, bytes32 _entityContext) external override assertCanCreateEntity {
        Entity f = new Entity(address(settings()), _entityAdmin, _entityContext);
        _addChild(address(f));
        emit NewEntity(address(f), msg.sender);
    }
}
