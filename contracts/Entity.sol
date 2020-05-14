pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";
import "./base/ISettingsKeys.sol";
import "./base/IEntityImpl.sol";

contract Entity is Controller, DiamondProxy {
  constructor (address _acl, address _settings) Controller(_acl, _settings) DiamondProxy() public {
    // setup implementation
    _upgrade(settings().getRootAddress(SETTING_ENTITY_IMPL));
  }

  // function upgrade (address _implementation) public assertIsAdmin {
  // }

  function _upgrade (address _implementation) internal {
    bytes[] memory data = new bytes[](1);
    data[0] = abi.encodePacked(
      _implementation,
      IEntityImpl.createPolicy.selector,
      IEntityImpl.getNumPolicies.selector,
      IEntityImpl.getPolicy.selector,
      IEntityImpl.deposit.selector,
      IEntityImpl.withdraw.selector,
      IEntityImpl.payTranchPremium.selector,
      IEntityImpl.trade.selector,
      IEntityImpl.sellAtBestPrice.selector
    );
    _upgradeDiamond(data);
  }
}
