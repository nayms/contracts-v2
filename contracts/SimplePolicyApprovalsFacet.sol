// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./SimplePolicyFacetBase.sol";
import "./base/ISimplePolicyApprovalsFacet.sol";
import "./base/ISimplePolicyStates.sol";
import "./base/ECDSA.sol";

contract SimplePolicyApprovalsFacet is SimplePolicyFacetBase, ISimplePolicyApprovalsFacet, ISimplePolicyStates, IDiamondFacet {
    using ECDSA for bytes32;

    constructor(address _settings) Controller(_settings) {
        // nothing to do here
    }

    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(ISimplePolicyApprovalsFacet.approve.selector);
    }

    function approve(bytes32[] memory _roles, bytes[] memory _signatures) external override {
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
