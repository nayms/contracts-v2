pragma solidity >=0.6.7;

import "./base/Address.sol";
import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import './base/IERC20.sol';
import "./base/IDiamondFacet.sol";
import "./base/AccessControl.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IPolicyTranchTokensFacet.sol";
import "./base/PolicyFacetBase.sol";
import "./base/IMarket.sol";
import "./base/SafeMath.sol";
import "./TranchToken.sol";

/**
 * @dev Core policy logic
 */
contract PolicyCoreFacet is EternalStorage, Controller, IDiamondFacet, IPolicyCoreFacet, PolicyFacetBase {
  using SafeMath for uint;
  using Address for address;

  // Modifiers //

  modifier assertCanCreateTranch () {
    require(inRoleGroup(msg.sender, ROLEGROUP_POLICY_OWNERS), 'must be policy owner');
    _;
  }

  modifier assertCreatedState () {
    require(dataUint256["state"] == POLICY_STATE_CREATED, 'must be in created state');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {}

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyCoreFacet.createTranch.selector,
      IPolicyCoreFacet.getInfo.selector,
      IPolicyCoreFacet.getTranchInfo.selector,
      IPolicyCoreFacet.calculateMaxNumOfPremiums.selector,
      IPolicyCoreFacet.initiationDateHasPassed.selector,
      IPolicyCoreFacet.startDateHasPassed.selector,
      IPolicyCoreFacet.maturationDateHasPassed.selector,
      IPolicyCoreFacet.checkAndUpdateState.selector
    );
  }

  // IPolicyCore //


  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] memory _premiums,
    address _initialBalanceHolder
  )
    public
    override
    assertCanCreateTranch
    assertCreatedState
  {
    require(_numShares > 0, 'invalid num of shares');
    require(_pricePerShareAmount > 0, 'invalid price');

    // instantiate tranches
    uint256 i = dataUint256["numTranches"];
    dataUint256["numTranches"] = i + 1;

    // setup initial data for tranch
    dataUint256[__i(i, "numShares")] = _numShares;
    dataUint256[__i(i, "pricePerShareAmount")] = _pricePerShareAmount;

    // iterate through premiums and figure out what needs to paid and when
    uint256 nextPayTime = dataUint256["initiationDate"];
    uint256 numPremiums = 0;
    for (uint256 p = 0; _premiums.length > p; p += 1) {
      // we only care about premiums > 0
      if (_premiums[p] > 0) {
        dataUint256[__ii(i, numPremiums, "premiumAmount")] = _premiums[p];
        dataUint256[__ii(i, numPremiums, "premiumDueAt")] = nextPayTime;
        numPremiums += 1;
      }

      // the premium interval still counts
      nextPayTime += dataUint256["premiumIntervalSeconds"];
    }
    // save total premiums
    require(numPremiums <= calculateMaxNumOfPremiums(), 'too many premiums');
    dataUint256[__i(i, "numPremiums")] = numPremiums;

    // deploy token contract
    TranchToken t = new TranchToken(address(this), i);

    // work out initial holder
    address holder = _initialBalanceHolder;
    if (holder == address(0)) {
      // by default it's this conract
      holder = address(this);
    }
    string memory initialHolderKey = __i(i, "initialHolder");
    dataAddress[initialHolderKey] = holder;

    // set initial holder balance
    string memory contractBalanceKey = __ia(i, dataAddress[initialHolderKey], "balance");
    dataUint256[contractBalanceKey] = _numShares;

    // save reference
    string memory addressKey = __i(i, "address");
    dataAddress[addressKey] = address(t);

    emit CreateTranch(address(t), dataAddress[initialHolderKey], i);
  }

  function getInfo () public view override returns (
    address creatorEntity_,
    uint256 initiationDate_,
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 premiumIntervalSeconds_,
    uint256 brokerCommissionBP_,
    uint256 capitalProviderCommissionBP_,
    uint256 naymsCommissionBP_,
    uint256 numTranches_,
    uint256 state_
  ) {
    creatorEntity_ = dataAddress["creatorEntity"];
    initiationDate_ = dataUint256["initiationDate"];
    startDate_ = dataUint256["startDate"];
    maturationDate_ = dataUint256["maturationDate"];
    unit_ = dataAddress["unit"];
    premiumIntervalSeconds_ = dataUint256["premiumIntervalSeconds"];
    brokerCommissionBP_ = dataUint256["brokerCommissionBP"];
    capitalProviderCommissionBP_ = dataUint256["capitalProviderCommissionBP"];
    naymsCommissionBP_ = dataUint256["naymsCommissionBP"];
    numTranches_ = dataUint256["numTranches"];
    state_ = dataUint256["state"];
  }

  function getTranchInfo (uint256 _index) public view override returns (
    address token_,
    uint256 state_,
    uint256 balance_,
    uint256 numPremiums_,
    uint256 nextPremiumAmount_,
    uint256 nextPremiumDueAt_,
    uint256 premiumPaymentsMissed_,
    uint256 numPremiumsPaid_,
    uint256 sharesSold_,
    uint256 initialSaleOfferId_,
    uint256 finalBuybackofferId_
  ) {
    token_ = dataAddress[__i(_index, "address")];
    state_ = dataUint256[__i(_index, "state")];
    balance_ = dataUint256[__i(_index, "balance")];
    numPremiums_ = dataUint256[__i(_index, "numPremiums")];
    (nextPremiumAmount_, nextPremiumDueAt_) = _getNextTranchPremium(_index);
    premiumPaymentsMissed_ = _getNumberOfTranchPaymentsMissed(_index);
    numPremiumsPaid_ = dataUint256[__i(_index, "numPremiumsPaid")];
    sharesSold_ = dataUint256[__i(_index, "sharesSold")];
    initialSaleOfferId_ = dataUint256[__i(_index, "initialSaleOfferId")];
    finalBuybackofferId_ = dataUint256[__i(_index, "finalBuybackOfferId")];
  }


  function initiationDateHasPassed () public view override returns (bool) {
    return now >= dataUint256["initiationDate"];
  }

  function startDateHasPassed () public view override returns (bool) {
    return now >= dataUint256["startDate"];
  }

  function maturationDateHasPassed () public view override returns (bool) {
    return now >= dataUint256["maturationDate"];
  }

  // heartbeat function!
  function checkAndUpdateState() public override {
    // past the initiation date
    if (initiationDateHasPassed()) {
      // past the start date
      if (startDateHasPassed()) {
        _ensureTranchesAreUpToDate();
        _activatePolicyIfPending();

        // if past the maturation date
        if (maturationDateHasPassed()) {
          _closePolicy();
        }
      }
      // not yet past start date
      else {
        _beginPolicySaleIfNotYetStarted();
      }
    }
  }

  function calculateMaxNumOfPremiums() public view override returns (uint256) {
    return (dataUint256["maturationDate"] - dataUint256["initiationDate"]) / dataUint256["premiumIntervalSeconds"] + 1;
  }


  function _cancelTranchMarketOffer(uint _index) private {
    IMarket market = IMarket(settings().getRootAddress(SETTING_MARKET));

    uint256 initialSaleOfferId = dataUint256[__i(_index, "initialSaleOfferId")];

    if (market.isActive(initialSaleOfferId)) {
      market.cancel(initialSaleOfferId);
    }
  }


  function _beginPolicySaleIfNotYetStarted() private {
    if (dataUint256["state"] == POLICY_STATE_CREATED) {
      IMarket market = IMarket(settings().getRootAddress(SETTING_MARKET));

      bool allReady = true;
      // check every tranch
      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        allReady = allReady && (0 >= _getNumberOfTranchPaymentsMissed(i));
      }

      // stop processing if some tranch payments have been missed
      if (!allReady) {
        return;
      }

      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        // tranch/token address
        address tranchAddress = dataAddress[__i(i, "address")];
        // initial token holder must be contract address
        address initialHolder = dataAddress[__i(i, "initialHolder")];
        require(initialHolder == address(this), "initial holder must be policy contract");
        // get supply
        uint256 totalSupply = IPolicyTranchTokensFacet(address(this)).tknTotalSupply(i);
        // calculate sale values
        uint256 pricePerShare = dataUint256[__i(i, "pricePerShareAmount")];
        uint256 totalPrice = totalSupply.mul(pricePerShare);
        // set tranch state
        _setTranchState(i, TRANCH_STATE_SELLING);
        // offer tokens in initial sale
        dataUint256[__i(i, "initialSaleOfferId")] = market.offer(
          totalSupply, tranchAddress, totalPrice, dataAddress["unit"], 0, false
        );
      }

      // set policy state to PENDING
      _setPolicyState(POLICY_STATE_SELLING);
    }
  }

  function _activatePolicyIfPending() private {
    // make policy active if necessary
    if (dataUint256["state"] == POLICY_STATE_SELLING) {
      _setPolicyState(POLICY_STATE_ACTIVE);
    }
  }

  function _ensureTranchesAreUpToDate() private {
    // check state of each tranch
    for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
      uint256 state = dataUint256[__i(i, "state")];

      // if tranch not yet fully sold OR if a payment has been missed
      if (state == TRANCH_STATE_SELLING || 0 < _getNumberOfTranchPaymentsMissed(i)) {
        // set state to cancelled
        // (do this before cancelling market order otherwise _transfer() logic goes haywire)
        _setTranchState(i, TRANCH_STATE_CANCELLED);
        // cancel any outstanding market order
        _cancelTranchMarketOffer(i);
      }
    }
  }


  function _closePolicy () private {
    _setPolicyState(POLICY_STATE_MATURED);

    // if no pending claims AND we haven't yet initiated tranch buyback
    if (0 == dataUint256["claimsPendingCount"] && !dataBool["buybackInitiated"]) {
      dataBool["buybackInitiated"] = true;

      address marketAddress = settings().getRootAddress(SETTING_MARKET);

      IMarket market = IMarket(marketAddress);

      // buy back all tranch tokens
      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        if (dataUint256[__i(i, "state")] == TRANCH_STATE_ACTIVE) {
          _setTranchState(i, TRANCH_STATE_MATURED);
        }

        address unitAddress = dataAddress["unit"];
        uint256 tranchBalance = dataUint256[__i(i, "balance")];

        IERC20 tkn = IERC20(unitAddress);
        tkn.approve(marketAddress, tranchBalance);

        // buy back all sold tokens
        dataUint256[__i(i, "finalBuybackOfferId")] = market.offer(
          tranchBalance,
          dataAddress["unit"],
          dataUint256[__i(i, "sharesSold")],
          dataAddress[__i(i, "address")],
          0,
          false
        );
      }
    }
  }

  function _getNextTranchPremium (uint256 _index) private view returns (uint256, uint256) {
    uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];

    return (
      dataUint256[__ii(_index, numPremiumsPaid, "premiumAmount")],
      dataUint256[__ii(_index, numPremiumsPaid, "premiumDueAt")]
    );
  }

  function _getNumberOfTranchPaymentsMissed (uint256 _index) private view returns (uint256) {
    uint256 numPremiums = dataUint256[__i(_index, "numPremiums")];
    uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];

    uint256 expectedNumPremiumsPaid = 0;

    for (uint256 i = 0; numPremiums > i; i += 1) {
      uint256 dueAt = dataUint256[__ii(_index, i, "premiumDueAt")];

      if (dueAt <= now) {
        expectedNumPremiumsPaid += 1;
      }
    }

    if (expectedNumPremiumsPaid >= numPremiumsPaid) {
      return expectedNumPremiumsPaid - numPremiumsPaid;
    } else {
      return 0;
    }
  }
}
