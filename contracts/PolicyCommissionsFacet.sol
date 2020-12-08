pragma solidity >=0.6.7;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyCommissionsFacet.sol";
import "./base/PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Policy commissions
 */
contract PolicyCommissionsFacet is EternalStorage, Controller, IDiamondFacet, IPolicyCommissionsFacet, PolicyFacetBase {
  modifier assertIsCapitalProvider (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_CAPITAL_PROVIDERS), 'must be capital provider');
    _;
  }

  modifier assertIsBroker (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_BROKERS), 'must be broker');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyCommissionsFacet.payCommissions.selector,
      IPolicyCommissionsFacet.getCommissionBalances.selector
    );
  }

  // IPolicyCommissionsFacet

  function getCommissionBalances() public view override returns (
    uint256 brokerCommissionBalance_,
    uint256 capitalProviderCommissionBalance_,
    uint256 naymsCommissionBalance_
  ) {
    brokerCommissionBalance_ = dataUint256["brokerCommissionBalance"];
    capitalProviderCommissionBalance_ = dataUint256["capitalProviderCommissionBalance"];
    naymsCommissionBalance_ = dataUint256["naymsCommissionBalance"];
  }


  function payCommissions (
    address _capitalProviderEntity, address _capitalProvider,
    address _brokerEntity, address _broker
  )
    public
    override
    assertIsCapitalProvider(_capitalProvider)
    assertIsBroker(_broker)
  {
    bytes32 capitalProviderEntityContext = AccessControl(_capitalProviderEntity).aclContext();
    require(acl().userSomeHasRoleInContext(capitalProviderEntityContext, _capitalProvider), 'must have role in capital provider entity');

    // check broker
    bytes32 brokerEntityContext = AccessControl(_brokerEntity).aclContext();
    require(acl().userSomeHasRoleInContext(brokerEntityContext, _broker), 'must have role in broker entity');

    // get nayms entity
    address naymsEntity = settings().getRootAddress(SETTING_NAYMS_ENTITY);

    // do payouts and update balances
    IERC20 tkn = IERC20(dataAddress["unit"]);

    tkn.transfer(_capitalProviderEntity, dataUint256["capitalProviderCommissionBalance"]);
    dataUint256["capitalProviderCommissionBalance"] = 0;

    tkn.transfer(_brokerEntity, dataUint256["brokerCommissionBalance"]);
    dataUint256["brokerCommissionBalance"] = 0;

    tkn.transfer(naymsEntity, dataUint256["naymsCommissionBalance"]);
    dataUint256["naymsCommissionBalance"] = 0;

    emit PaidCommissions(_capitalProviderEntity, _brokerEntity, msg.sender);
  }
}
