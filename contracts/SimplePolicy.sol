// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./base/Controller.sol";
import "./base/Proxy.sol";
import "./base/Child.sol";
import "./SimplePolicyFacetBase.sol";
import "./base/ISimplePolicyStates.sol";

struct Stakeholders {
    bytes32[] roles;
    address[] stakeholdersAddresses;
    bytes[] approvalSignatures;
    uint256[] commissions; // always has one element more than roles, for nayms treasury
}

contract SimplePolicy is 
    Controller, 
    Proxy, 
    SimplePolicyFacetBase, 
    Child, 
    ISimplePolicyStates 
{
    
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

        _setParent(msg.sender);
        _setDelegateAddress(settings().getRootAddress(SETTING_POLICY_DELEGATE));

        // set policy attributes
        dataBytes32["id"] = _id;
        dataUint256["number"] = _number;
        dataUint256["startDate"] = _startDate;
        dataUint256["maturationDate"] = _maturationDate;
        dataAddress["unit"] = _unit;
        dataUint256["limit"] = _limit;
        dataUint256["state"] = POLICY_STATE_CREATED;

        address broker;
        address underwriter;

        // set the roles and commissions
        acl().assignRole(aclContext(), _caller, ROLE_POLICY_OWNER);

        uint256 rolesCount = _stakeholders.roles.length;
        for (uint256 i = 0; i < rolesCount; i += 1) {
            bytes32 role = _stakeholders.roles[i];

            acl().assignRole(aclContext(), _stakeholders.stakeholdersAddresses[i], role);

            if (role == ROLE_BROKER) {
                broker = _stakeholders.stakeholdersAddresses[i];
                dataUint256["brokerCommissionBP"] = _stakeholders.commissions[i];
            } else if (role == ROLE_UNDERWRITER) {
                underwriter = _stakeholders.stakeholdersAddresses[i];
                dataUint256["underwriterCommissionBP"] = _stakeholders.commissions[i];
            } else if (role == ROLE_CLAIMS_ADMIN) {
                dataUint256["claimsAdminCommissionBP"] = _stakeholders.commissions[i];
            }
        }

        // these are always the last item in array, there is one element more than roles count
        // for storing nayms treasury address and it's commission
        dataAddress["treasury"] = _stakeholders.stakeholdersAddresses[rolesCount];
        dataUint256["naymsCommissionBP"] = _stakeholders.commissions[rolesCount];

        bool underwriterRep;
        bool brokerRep;
        (underwriterRep, brokerRep) = _isBrokerOrUnderwriterRep(_caller, broker, underwriter);

        require(underwriterRep || brokerRep, "must be broker or underwriter");

        dataBool["underwriterApproved"] = underwriterRep;
        dataBool["brokerApproved"] = brokerRep;
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
}
