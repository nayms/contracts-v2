pragma solidity >=0.6.7;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyCommissions.sol";
import "./base/PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Policy commissions
 */
contract PolicyCommissions is EternalStorage, Controller, IDiamondFacet, IPolicyCommissions, PolicyFacetBase {
  modifier assertIsAssetManager (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_ASSET_MANAGERS), 'must be asset manager');
    _;
  }

  modifier assertIsBroker (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_BROKERS), 'must be broker');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyCommissions.payCommissions.selector,
      IPolicyCommissions.getCommissionBalances.selector
    );
  }

  // IPolicyCommissions

  function getCommissionBalances() public view override returns (
    uint256 brokerCommissionBalance_,
    uint256 assetManagerCommissionBalance_,
    uint256 naymsCommissionBalance_
  ) {
    brokerCommissionBalance_ = dataUint256["brokerCommissionBalance"];
    assetManagerCommissionBalance_ = dataUint256["assetManagerCommissionBalance"];
    naymsCommissionBalance_ = dataUint256["naymsCommissionBalance"];
  }


  function payCommissions (
    address _assetManagerEntity, address _assetManager,
    address _brokerEntity, address _broker
  )
    public
    override
    assertIsAssetManager(_assetManager)
    assertIsBroker(_broker)
  {
    bytes32 assetManagerEntityContext = AccessControl(_assetManagerEntity).aclContext();
    require(acl().userSomeHasRoleInContext(assetManagerEntityContext, _assetManager), 'must have role in asset manager entity');

    // check broker
    bytes32 brokerEntityContext = AccessControl(_brokerEntity).aclContext();
    require(acl().userSomeHasRoleInContext(brokerEntityContext, _broker), 'must have role in broker entity');

    // get nayms entity
    address naymsEntity = settings().getRootAddress(SETTING_NAYMS_ENTITY);

    // do payouts and update balances
    IERC20 tkn = IERC20(dataAddress["unit"]);

    tkn.transfer(_assetManagerEntity, dataUint256["assetManagerCommissionBalance"]);
    dataUint256["assetManagerCommissionBalance"] = 0;

    tkn.transfer(_brokerEntity, dataUint256["brokerCommissionBalance"]);
    dataUint256["brokerCommissionBalance"] = 0;

    tkn.transfer(naymsEntity, dataUint256["naymsCommissionBalance"]);
    dataUint256["naymsCommissionBalance"] = 0;

    emit PaidCommissions(_assetManagerEntity, _brokerEntity, msg.sender);
  }
}
