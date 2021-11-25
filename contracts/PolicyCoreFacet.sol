// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./base/Address.sol";
import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import './base/IERC20.sol';
import "./base/IDiamondFacet.sol";
import "./base/AccessControl.sol";
import "./base/IChild.sol";
import "./base/Child.sol";
import "./base/IPolicyTreasuryConstants.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IPolicyTrancheTokensFacet.sol";
import "./base/IMarketObserverDataTypes.sol";
import "./base/IMarketFeeSchedules.sol";
import "./base/IPolicyTypes.sol";
import "./PolicyFacetBase.sol";
import "./base/SafeMath.sol";
import "./TrancheToken.sol";
import "./base/ReentrancyGuard.sol";

/**
 * @dev Core policy logic
 */
contract PolicyCoreFacet is EternalStorage, Controller, IDiamondFacet, IPolicyCoreFacet, IPolicyTypes, PolicyFacetBase, IPolicyTreasuryConstants, ReentrancyGuard, IMarketObserverDataTypes, IMarketFeeSchedules, Child {
  using SafeMath for uint;
  using Address for address;

  // Modifiers //

  modifier assertIsOwner () {
    require(inRoleGroup(msg.sender, ROLEGROUP_POLICY_OWNERS), 'must be policy owner');
    _;
  }

  modifier assertCanCreateTranche () {
    require(inRoleGroup(msg.sender, ROLEGROUP_POLICY_OWNERS) || msg.sender == getParent(), 'must be policy owner or original creator');
    _;
  }

  modifier assertCreatedState () {
    require(dataUint256["state"] == POLICY_STATE_CREATED, 'must be in created state');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
    // nothing
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyCoreFacet.createTranche.selector,
      IPolicyCoreFacet.getInfo.selector,
      IPolicyCoreFacet.getTrancheInfo.selector,
      // IPolicyCoreFacet.calculateMaxNumOfPremiums.selector,
      IPolicyCoreFacet.initiationDateHasPassed.selector,
      IPolicyCoreFacet.startDateHasPassed.selector,
      IPolicyCoreFacet.maturationDateHasPassed.selector,
      IPolicyCoreFacet.checkAndUpdateState.selector,
      IChild.getParent.selector
    );
  }

  // IPolicyCore //


  function createTranche (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] calldata _premiums
  )
    external
    override
    assertCanCreateTranche
    assertCreatedState
  {
    require(_numShares > 0, 'invalid num of shares');
    require(_pricePerShareAmount > 0, 'invalid price');

    // tranche count
    uint256 i = dataUint256["numTranches"];
    dataUint256["numTranches"] = i + 1;
    // require(dataUint256["numTranches"] <= 99, 'max tranches reached');

    // setup initial data for tranche
    dataUint256[__i(i, "numShares")] = _numShares;
    dataUint256[__i(i, "pricePerShareAmount")] = _pricePerShareAmount;

    // iterate through premiums and figure out what needs to paid and when
    // uint256 nextPayTime = dataUint256["initiationDate"];
    uint256 numPremiums = 0;

    // for (uint256 p = 0; _premiums.length > p; p += 1) {
    //   // we only care about premiums > 0
    //   if (_premiums[p] > 0) {
    //     dataUint256[__ii(i, numPremiums, "premiumAmount")] = _premiums[p];
    //     dataUint256[__ii(i, numPremiums, "premiumDueAt")] = nextPayTime;
    //     numPremiums += 1;
    //   }

    //   // the premium interval still counts
    //   // nextPayTime += dataUint256["premiumIntervalSeconds"];
    // }
    // // save total premiums

    uint256 previousPremiumDueAt = 0;
    for (uint256 p = 0; _premiums.length > p; p += 2) {

      if (_premiums[p+1] > 0) {

        dataUint256[__ii(i, numPremiums, "premiumDueAt")] = _premiums[p];
        dataUint256[__ii(i, numPremiums, "premiumAmount")] = _premiums[p+1];

        require(dataUint256["initiationDate"] <= _premiums[p], 'premium befire initiation');
        require(_premiums[p] <= dataUint256["maturationDate"], 'premium after maturation');
        require(_premiums[p] > previousPremiumDueAt, 'premiums not in increasing order');

        previousPremiumDueAt = _premiums[p];
        numPremiums += 1;
      }
    }    




    // require(numPremiums <= calculateMaxNumOfPremiums(), 'too many premiums');
    dataUint256[__i(i, "numPremiums")] = numPremiums;

    // deploy token contract if SPV
    if (dataUint256["type"] == POLICY_TYPE_SPV) {
      TrancheToken t = new TrancheToken(address(this), i);

      // initial holder
      address holder = dataAddress["treasury"];
      string memory initialHolderKey = __i(i, "initialHolder");
      dataAddress[initialHolderKey] = holder;

      // set initial holder balance
      string memory contractBalanceKey = __ia(i, dataAddress[initialHolderKey], "balance");
      dataUint256[contractBalanceKey] = _numShares;

      // save reference
      string memory addressKey = __i(i, "address");
      dataAddress[addressKey] = address(t);
    }

    emit CreateTranche(i);
  }

  function getInfo () public view override returns (
    bytes32 id_,
    address treasury_,
    uint256 initiationDate_,
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    // uint256 premiumIntervalSeconds_,
    uint256 numTranches_,
    uint256 state_,
    uint256 type_
  ) {
    id_ = dataBytes32["id"];
    treasury_ = dataAddress["treasury"];
    initiationDate_ = dataUint256["initiationDate"];
    startDate_ = dataUint256["startDate"];
    maturationDate_ = dataUint256["maturationDate"];
    unit_ = dataAddress["unit"];
    // premiumIntervalSeconds_ = dataUint256["premiumIntervalSeconds"];
    numTranches_ = dataUint256["numTranches"];
    state_ = dataUint256["state"];
    type_ = dataUint256["type"];
  }

  function getTrancheInfo (uint256 _index) public view override returns (
    address token_,
    uint256 state_,
    uint256 numShares_,
    uint256 initialPricePerShare_,
    uint256 balance_,
    uint256 sharesSold_,
    uint256 initialSaleOfferId_,
    uint256 finalBuybackofferId_,
    bool buybackCompleted_
  ) {
    token_ = dataAddress[__i(_index, "address")];
    state_ = dataUint256[__i(_index, "state")];
    numShares_ = dataUint256[__i(_index, "numShares")];
    initialPricePerShare_ = dataUint256[__i(_index, "pricePerShareAmount")];
    balance_ = dataUint256[__i(_index, "balance")];
    sharesSold_ = dataUint256[__i(_index, "sharesSold")];
    initialSaleOfferId_ = dataUint256[__i(_index, "initialSaleOfferId")];
    finalBuybackofferId_ = dataUint256[__i(_index, "finalBuybackOfferId")];
    buybackCompleted_ = dataBool[__i(_index, "buybackCompleted")];
  }


  function initiationDateHasPassed () public view override returns (bool) {
    return block.timestamp >= dataUint256["initiationDate"];
  }

  function startDateHasPassed () public view override returns (bool) {
    return block.timestamp >= dataUint256["startDate"];
  }

  function maturationDateHasPassed () public view override returns (bool) {
    return block.timestamp >= dataUint256["maturationDate"];
  }

  // heartbeat function!
  function checkAndUpdateState() public override nonReentrant {
    // past the initiation date
    if (initiationDateHasPassed()) {
      // past the start date
      if (startDateHasPassed()) {
        _ensureTranchesAreUpToDate();
        _activatePolicyIfPending();

        // if past the maturation date
        if (maturationDateHasPassed()) {
          _maturePolicy();
        }
      }
      // not yet past start date
      else {
        _cancelPolicyIfNotFullyApproved();
        _beginPolicySaleIfNotYetStarted();
      }
    }
  }

  // function calculateMaxNumOfPremiums() public view override returns (uint256) {
  //   return (dataUint256["maturationDate"] - dataUint256["initiationDate"]) / dataUint256["premiumIntervalSeconds"] + 1;
  // }

  // Internal methods

  function _cancelTrancheMarketOffer(uint _index) private {
    uint256 initialSaleOfferId = dataUint256[__i(_index, "initialSaleOfferId")];
    _getTreasury().cancelOrder(initialSaleOfferId);
  }

  function _cancelPolicyIfNotFullyApproved() private {
    if (dataUint256["state"] == POLICY_STATE_CREATED || dataUint256["state"] == POLICY_STATE_IN_APPROVAL) {
      _setPolicyState(POLICY_STATE_CANCELLED);
    }
  }

  function _beginPolicySaleIfNotYetStarted() private {
    if (dataUint256["state"] == POLICY_STATE_APPROVED) {
      // skip token sale for portfolio-type of policy
      if (dataUint256["type"] == POLICY_TYPE_PORTFOLIO) {
        _setPolicyState(POLICY_STATE_INITIATED);
        return;
      }

      bool allReady = true;
      // check every tranche
      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        allReady = allReady && (0 >= _getNumberOfTranchePaymentsMissed(i));
      }

      // stop processing if some tranche payments have been missed
      if (!allReady) {
        return;
      }

      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        // tranche/token address
        address trancheAddress = dataAddress[__i(i, "address")];
        // get supply
        uint256 totalSupply = IPolicyTrancheTokensFacet(address(this)).tknTotalSupply(i);
        // calculate sale values
        uint256 pricePerShare = dataUint256[__i(i, "pricePerShareAmount")];
        uint256 totalPrice = totalSupply.mul(pricePerShare);
        // set tranche state
        _setTrancheState(i, TRANCHE_STATE_SELLING);
        // offer tokens in initial sale
        dataUint256[__i(i, "initialSaleOfferId")] = _getTreasury().createOrder(
          ORDER_TYPE_TOKEN_SALE,
          trancheAddress, 
          totalSupply, 
          dataAddress["unit"], 
          totalPrice,
          FEE_SCHEDULE_PLATFORM_ACTION,
          address(this),
          abi.encode(MODT_TRANCHE_SALE, address(this), i)
        );
      }

      // set policy state to selling
      _setPolicyState(POLICY_STATE_INITIATED);
    }
  }

  function _activatePolicyIfPending() private {
    // make policy active if necessary
    if (dataUint256["state"] == POLICY_STATE_INITIATED) {
      // calculate total collateral requried
      uint256 minPolicyCollateral = 0;
      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        if (dataUint256["type"] == POLICY_TYPE_PORTFOLIO) {
          _setTrancheState(i, TRANCHE_STATE_ACTIVE);
        }
        
        if (dataUint256[__i(i, "state")] == TRANCHE_STATE_ACTIVE) {
          minPolicyCollateral += dataUint256[__i(i, "sharesSold")] * dataUint256[__i(i, "pricePerShareAmount")];
        }
      }
      // set min. collateral balance to treasury
      _getTreasury().setMinPolicyBalance(minPolicyCollateral);

      // update policy state
      _setPolicyState(POLICY_STATE_ACTIVE);
    }
  }

  function _ensureTranchesAreUpToDate() private {
    // check state of each tranche
    for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
      uint256 state = dataUint256[__i(i, "state")];

      // if tranche not yet fully sold OR if a payment has been missed
      if (state == TRANCHE_STATE_SELLING || 0 < _getNumberOfTranchePaymentsMissed(i)) {
        // set state to cancelled
        // (do this before cancelling market order otherwise _transfer() logic goes haywire)
        _setTrancheState(i, TRANCHE_STATE_CANCELLED);
        // cancel any outstanding market order
        _cancelTrancheMarketOffer(i);
      }
    }
  }


  function _maturePolicy () private {
    // if no pending claims
    if (0 == dataUint256["claimsPendingCount"] && _getTreasury().isPolicyCollateralized(address(this))) {
      // if we haven't yet initiated policy buyback
      if (dataUint256["state"] == POLICY_STATE_ACTIVE || dataUint256["state"] == POLICY_STATE_MATURED) {
        // if it's portfolio type then straight to closing
        if (dataUint256["type"] == POLICY_TYPE_PORTFOLIO) {
          _setPolicyState(POLICY_STATE_CLOSED);
          return;
        }

        _setPolicyState(POLICY_STATE_BUYBACK);

        // buy back all tranche tokens
        for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
          if (dataUint256[__i(i, "state")] == TRANCHE_STATE_ACTIVE) {
            _setTrancheState(i, TRANCHE_STATE_MATURED);
          }

          address unitAddress = dataAddress["unit"];
          uint256 trancheBalance = dataUint256[__i(i, "balance")];

          // buy back all sold tokens
          dataUint256[__i(i, "finalBuybackOfferId")] = _getTreasury().createOrder(
            ORDER_TYPE_TOKEN_BUYBACK,
            unitAddress,
            trancheBalance,
            dataAddress[__i(i, "address")],
            dataUint256[__i(i, "sharesSold")],
            FEE_SCHEDULE_PLATFORM_ACTION,
            address(this),
            abi.encode(MODT_TRANCHE_BUYBACK, address(this), i)
          );
        }
      }
    } 
    // if there are pending claims
    else {
      _setPolicyState(POLICY_STATE_MATURED);
    }
  }
}
