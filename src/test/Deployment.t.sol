// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./utils/DSTestPlusF.sol";

import {IACLConstants} from  "../../contracts/base/IACLConstants.sol";
import {ISettingsKeys} from  "../../contracts/base/ISettingsKeys.sol";
import {AccessControl} from "../../contracts/base/AccessControl.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from  "../../contracts/Settings.sol";
import {ISettings} from  "../../contracts/base/ISettings.sol";

import {IMarket} from "../../contracts/base/IMarket.sol";
import {Market} from "../../contracts/Market.sol";
import {MarketCoreFacet} from "../../contracts/MarketCoreFacet.sol";
import {MarketDataFacet} from "../../contracts/MarketDataFacet.sol";

contract DeploymentTest is DSTestPlusF, IACLConstants, ISettingsKeys {
    
    ACL internal acl;
    Settings internal settings;
    AccessControl internal accessControl;
    
    bytes32 internal systemContext;
    
    Market internal market;
    MarketCoreFacet internal mcf;
    MarketDataFacet internal mdf;
    
    function setUp() public {
        // acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        // settings = new Settings(address(acl));
        // accessControl = new AccessControl(address(settings));
        

    
        // mcf = new MarketCoreFacet(settings);
        // mdf = new MarketDataFacet(settings); 
        
        // market = new Market(settings);
        
    }
    
    function testDeploy() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        accessControl = new AccessControl(address(settings));
        systemContext = acl.systemContext();
        mcf = new MarketCoreFacet(address(settings));
        mdf = new MarketDataFacet(address(settings)); 
        
        address[] memory addys = new address[](2);
        addys[0] = address(mcf);
        addys[1] = address(mdf);
        
        settings.setAddresses(address(settings), SETTING_MARKET_IMPL, addys); // facets use the key with suffix _IMPL
        market = new Market(address(settings));
        
        settings.setAddress(address(settings), SETTING_MARKET, address(market)); // proxy diamond
        
        console.log(address(market));
        vm.label(address(market), "Market Proxy Diamond");
        
        uint256 dust;
        uint256 feeBP;
        
        (dust, feeBP) = IMarket(address(market)).getConfig();
        assertEq(dust, 1);
        assertEq(feeBP, 0);
        
    }
}