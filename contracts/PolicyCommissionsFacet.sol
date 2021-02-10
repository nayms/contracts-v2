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
  modifier assertPolicyApproved () {
    uint256 state = dataUint256["state"];
    require(state != POLICY_STATE_IN_APPROVAL && state != POLICY_STATE_CREATED, 'must be approved');
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


  function payCommissions ()
    public
    override
    assertPolicyApproved
  {
    address underwriter = _getEntityWithRole(ROLE_UNDERWRITER);
    address broker = _getEntityWithRole(ROLE_BROKER);
    // get nayms entity
    address naymsEntity = settings().getRootAddress(SETTING_NAYMS_ENTITY);

    // do payouts and update balances
    IERC20 tkn = IERC20(dataAddress["unit"]);

    if (dataUint256["capitalProviderCommissionBalance"] > 0) {
      tkn.transfer(underwriter, dataUint256["capitalProviderCommissionBalance"]);
      dataUint256["capitalProviderCommissionBalance"] = 0;
    }
  
    if (dataUint256["brokerCommissionBalance"] > 0) {
      tkn.transfer(broker, dataUint256["brokerCommissionBalance"]);
      dataUint256["brokerCommissionBalance"] = 0;
    }

    if (dataUint256["naymsCommissionBalance"] > 0) {
      tkn.transfer(naymsEntity, dataUint256["naymsCommissionBalance"]);
      dataUint256["naymsCommissionBalance"] = 0;
    }

    emit PaidCommissions(underwriter, broker, msg.sender);
  }
}
