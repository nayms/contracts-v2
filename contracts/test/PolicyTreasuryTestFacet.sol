pragma solidity >=0.6.7;

import "../base/EternalStorage.sol";
import "../base/IDiamondFacet.sol";
import "../base/PolicyFacetBase.sol";
import "../base/Controller.sol";

interface IPolicyTreasuryTestFacet is IDiamondFacet {
  function treasuryIncPolicyBalance (uint256 _amount) external;
  function treasurySetMinPolicyBalance (uint256 _amount) external;
  function treasuryPayClaim (address _recipient, uint256 _amount) external;
}

contract PolicyTreasuryTestFacet is EternalStorage, PolicyFacetBase, IPolicyTreasuryTestFacet, Controller {
  constructor (address _settings) Controller(_settings) public {
    // nothing
  }

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyTreasuryTestFacet.treasuryIncPolicyBalance.selector,
      IPolicyTreasuryTestFacet.treasurySetMinPolicyBalance.selector,
      IPolicyTreasuryTestFacet.treasuryPayClaim.selector
    );
  }

  function treasuryIncPolicyBalance (uint256 _amount) public override {
    _getTreasury().incPolicyBalance(_amount);
  }

  function treasurySetMinPolicyBalance (uint256 _amount) public override {
    _getTreasury().setMinPolicyBalance(_amount);
  }

  function treasuryPayClaim (address _recipient, uint256 _amount) public override {
    _getTreasury().payClaim(_recipient, _amount);
  }
}
