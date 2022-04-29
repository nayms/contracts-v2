// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./base/ECDSA.sol";
import "./base/AccessControl.sol";
import "./base/Controller.sol";
import "./base/Proxy.sol";
import "./base/ISimplePolicy.sol";
import "./base/ISimplePolicyStates.sol";

contract SimplePolicy is Controller, Proxy, ISimplePolicy, ISimplePolicyStates {
    using ECDSA for bytes32;

    struct Stakeholders {
        bytes32[] roles;
        address[] stakeholdersAddresses;
        bytes[] approvalSignatures;
        uint256[] commissions;
    }

    /**
     * @dev SimplePolicy constructor.
     */
    constructor(
        bytes32 _id,
        uint256 _number,
        address _settings,
        address _caller,
        uint256 _startDate,
        uint256 _maturationDate,
        address _unit,
        uint256 _limit,
        Stakeholders memory _stakeholders
    ) Controller(_settings) Proxy() {
        require(_limit > 0, "limit not > 0");

        dataBytes32["id"] = _id;
        dataUint256["number"] = _number;
        dataUint256["startDate"] = _startDate;
        dataUint256["maturationDate"] = _maturationDate;
        dataAddress["unit"] = _unit;
        dataUint256["limit"] = _limit;
        dataUint256["state"] = POLICY_STATE_CREATED;

        // TODO AM: implement corresponding mapping
        // dataAddress["treasury"] = _stakeholders[4];

        address broker;
        address underwriter;

        // set roles and commissions
        acl().assignRole(aclContext(), _caller, ROLE_POLICY_OWNER);
        for (uint256 i = 0; i < _stakeholders.roles.length; i += 1) {
            bytes32 role = _stakeholders.roles[i];

            acl().assignRole(aclContext(), _stakeholders.stakeholdersAddresses[i], role);

            if (role == ROLE_BROKER) {
                broker = _stakeholders.stakeholdersAddresses[i];
                dataUint256["brokerCommissionBP"] = _stakeholders.commissions[i];
            } else if (role == ROLE_UNDERWRITER) {
                underwriter = _stakeholders.stakeholdersAddresses[i];
                dataUint256["underwriterCommissionBP"] = _stakeholders.commissions[i];
            } else if (role == ROLE_INSURED_PARTY) {
                dataUint256["insuredPartyCommissionBP"] = _stakeholders.commissions[i];
            } else if (role == ROLE_CLAIMS_ADMIN) {
                dataUint256["claimsAdminCommissionBP"] = _stakeholders.commissions[i];
            }
        }

        bool underwriterRep;
        bool brokerRep;
        (underwriterRep, brokerRep) = _isBrokerOrUnderwriterRep(_caller, broker, underwriter);

        require(underwriterRep || brokerRep, "must be broker or underwriter");

        dataBool["underwriterApproved"] = underwriterRep;
        dataBool["brokerApproved"] = brokerRep;

        _bulkApprove(_stakeholders.roles, _stakeholders.approvalSignatures);

        emit NewSimplePolicy(_id, address(this));
    }

    function _isBrokerOrUnderwriterRep(
        address _caller,
        address _broker,
        address _underwriter
    ) internal view returns (bool underwriterRep_, bool brokerRep_) {
        bytes32 ctxSystem = acl().getContextAtIndex(0);
        bytes32 ctxBroker = AccessControl(_broker).aclContext();
        bytes32 ctxUnderwriter = AccessControl(_underwriter).aclContext();

        // entity has underwriter role in system context?
        bool isUnderwriter = acl().hasRoleInGroup(ctxSystem, _underwriter, ROLEGROUP_UNDERWRITERS);

        // caller is underwriter entity rep?
        underwriterRep_ = isUnderwriter && acl().hasRoleInGroup(ctxUnderwriter, _caller, ROLEGROUP_ENTITY_REPS);

        // entity has broker role in system context?
        bool isBroker = acl().hasRoleInGroup(ctxSystem, _broker, ROLE_BROKER);

        // caller is broker entity rep?
        brokerRep_ = isBroker && acl().hasRoleInGroup(ctxBroker, _caller, ROLEGROUP_ENTITY_REPS);
    }

    function getSimplePolicyInfo()
        external
        view
        override
        returns (
            bytes32 id_,
            uint256 number_,
            uint256 startDate_,
            uint256 maturationDate_,
            address unit_,
            uint256 limit_,
            uint256 state_
        )
    {
        id_ = dataBytes32["id"];
        number_ = dataUint256["number"];
        startDate_ = dataUint256["startDate"];
        maturationDate_ = dataUint256["maturationDate"];
        unit_ = dataAddress["unit"];
        limit_ = dataUint256["limit"];
        state_ = dataUint256["state"];
    }

    function checkAndUpdateState() external virtual override returns (bool reduceTotalLimit_) {
        bytes32 id = dataBytes32["id"];
        uint256 state = dataUint256["state"];
        reduceTotalLimit_ = false;

        if (block.timestamp >= dataUint256["maturationDate"] && state < POLICY_STATE_MATURED) {
            // move state to matured
            dataUint256["state"] = POLICY_STATE_MATURED;

            reduceTotalLimit_ = true;

            // emit event
            emit SimplePolicyStateUpdated(id, POLICY_STATE_MATURED, msg.sender);
        } else if (block.timestamp >= dataUint256["startDate"] && state < POLICY_STATE_ACTIVE) {
            // move state to active
            dataUint256["state"] = POLICY_STATE_ACTIVE;

            // emit event
            emit SimplePolicyStateUpdated(id, POLICY_STATE_ACTIVE, msg.sender);
        }
    }

    function _bulkApprove(bytes32[] memory _roles, bytes[] memory _signatures) private {
        bytes32 h = dataBytes32["id"];

        require(_signatures.length == _roles.length, "wrong number of signatures");

        for (uint256 i = 0; i < _roles.length; i += 1) {
            _approve(_roles[i], h.toEthSignedMessageHash().recover(_signatures[i]));
        }

        dataUint256["state"] = POLICY_STATE_APPROVED;
    }

    function _approve(bytes32 _role, address _approver) private assertBelongsToEntityWithRole(_approver, _role) {
        if (_role == ROLE_UNDERWRITER) {
            dataBool["underwriterApproved"] = true;
        } else if (_role == ROLE_BROKER) {
            dataBool["brokerApproved"] = true;
        } else if (_role == ROLE_INSURED_PARTY) {
            dataBool["insuredPartyApproved"] = true;
        } else if (_role == ROLE_CLAIMS_ADMIN) {
            dataBool["claimsAdminApproved"] = true;
        }

        address entity = _getEntityWithRole(_role);
        acl().assignRole(aclContext(), entity, _role);
    }
}
