// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./utils/DSTestPlusF.sol";

import {IACLConstants} from "../../contracts/base/IACLConstants.sol";
import {ISettingsKeys} from "../../contracts/base/ISettingsKeys.sol";
import {IACL} from "../../contracts/base/IACL.sol";
import {AccessControl} from "../../contracts/base/AccessControl.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from "../../contracts/Settings.sol";

import {Market} from "../../contracts/Market.sol";
import {MarketCoreFacet} from "../../contracts/MarketCoreFacet.sol";
import {MarketDataFacet} from "../../contracts/MarketDataFacet.sol";

import {NaymsMock} from "./utils/mocks/NaymsMock.sol";
import {NaymsUser} from "./utils/users/NaymsUser.sol";

contract EntityTest is DSTestPlusF, IACLConstants, ISettingsKeys {
    NaymsMock internal nayms;
    NaymsUser internal alice;
    NaymsUser internal bob;
    NaymsUser internal charlie;

    bytes32 internal systemContext;

    Market internal market;
    MarketCoreFacet internal mcf;
    MarketDataFacet internal mdf;

    function setUp() public {
        nayms = new NaymsMock();
        alice = new NaymsUser(nayms);
        bob = new NaymsUser(nayms);
        charlie = new NaymsUser(nayms);

        systemContext = nayms.systemContext();

        IACL(address(nayms)).addAdmin(address(alice));
        alice.removeAdmin(address(nayms));

        // mcf = new MarketCoreFacet()
    }

    function testAdmin() public {
        alice.isAdmin(address(this));
    }

    // function testUnassignRole() public {
    //     alice.assignRole(systemContext, address(charlie), ROLE_APPROVED_USER);

    // }
}
// 1. deploy facets
// 2. call settings to register facet addresses
// 3. deploy diamond proxy and pass in settings address
