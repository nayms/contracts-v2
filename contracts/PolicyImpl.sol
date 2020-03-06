pragma solidity >=0.5.8;

import "./base/Address.sol";
import "./base/Delegate.sol";
import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import './base/IERC20.sol';
import "./base/IProxyImpl.sol";
import "./base/AccessControl.sol";
import "./base/IPolicyImpl.sol";
import "./base/IPolicyStates.sol";
import "./base/IMarket.sol";
import "./base/ITranchTokenHelper.sol";
import "./base/SafeMath.sol";
import "./TranchToken.sol";

/**
 * @dev Business-logic for Policy
 */
contract PolicyImpl is EternalStorage, Controller, IProxyImpl, IPolicyImpl, IPolicyStates, ITranchTokenHelper {
  using SafeMath for uint;
  using Address for address;
  using Delegate for *;

  // Modifiers //

  modifier assertCanCreateTranch () {
    require(inRoleGroup(msg.sender, ROLEGROUP_POLICY_OWNERS), 'must be policy owner');
    _;
  }

  modifier assertCreatedState () {
    require(dataUint256["state"] == POLICY_STATE_CREATED, 'must be in created state');
    _;
  }

  modifier assertIsAssetManager (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_ASSET_MANAGERS), 'must be asset manager');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {}

  // IProxyImpl //

  function getImplementationVersion () public pure returns (string memory) {
    return "v1";
  }

  // IPolicyImpl //

  function getStartDate () public view returns (uint256) {
    return dataUint256["startDate"];
  }

  function getState () public view returns (uint256) {
    return dataUint256["state"];
  }

  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] memory _premiums,
    address _initialBalanceHolder
  )
    public
    assertCanCreateTranch
    assertCreatedState
    returns (uint256)
  {
    require(_numShares > 0, 'invalid num of shares');
    require(_pricePerShareAmount > 0, 'invalid price');
    require(_premiums.length <= calculateMaxNumOfPremiums(), 'too many premiums');

    // instantiate tranches
    uint256 i = dataUint256["numTranches"];
    dataUint256["numTranches"] = i + 1;

    // setup initial data for tranch
    dataUint256[__i(i, "numShares")] = _numShares;
    dataUint256[__i(i, "pricePerShareAmount")] = _pricePerShareAmount;
    dataManyUint256[__i(i, "premiums")] = _premiums;

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

    emit CreateTranch(address(this), address(t), dataAddress[initialHolderKey], i);

    return i;
  }

  function getNumTranches () public view returns (uint256) {
    return dataUint256["numTranches"];
  }

  function getTranchInfo (uint256 _index) public view returns (
    address token_,
    uint256 state_,
    uint256 balance_,
    uint256 nextPremiumAmount_,
    uint256 premiumPaymentsMissed_,
    bool allPremiumsPaid_,
    uint256 sharesSold_,
    uint256 initialSaleOfferId_,
    uint256 finalBuybackofferId_
  ) {
    token_ = dataAddress[__i(_index, "address")];
    state_ = dataUint256[__i(_index, "state")];
    balance_ = dataUint256[__i(_index, "balance")];
    nextPremiumAmount_ = _getNextTranchPremiumAmount(_index);
    premiumPaymentsMissed_ = _getNumberOfTranchPaymentsMissed(_index);
    allPremiumsPaid_ = _tranchPaymentsAllMade(_index);
    sharesSold_ = dataUint256[__i(_index, "sharesSold")];
    initialSaleOfferId_ = dataUint256[__i(_index, "initialSaleOfferId")];
    finalBuybackofferId_ = dataUint256[__i(_index, "finalBuybackOfferId")];
  }


  function payTranchPremium (uint256 _index) public {
    require(!_tranchPaymentsAllMade(_index), 'all payments already made');

    uint256 expectedAmount = _getNextTranchPremiumAmount(_index);

    if (expectedAmount > 0) {
      // transfer
      IERC20 tkn = IERC20(dataAddress["unit"]);
      tkn.transferFrom(msg.sender, address(this), expectedAmount);
    }

    // record the payments
    uint256 paymentIndex = dataUint256[__i(_index, "premiumsPaid")];
    dataUint256[__ii(_index, paymentIndex, "premiumPayment")] = expectedAmount;
    dataAddress[__ii(_index, paymentIndex, "premiumPayer")] = msg.sender;
    dataUint256[__i(_index, "premiumsPaid")] = paymentIndex + 1;

    // calculate commissions
    uint256 brokerCommission = dataUint256["brokerCommissionBP"].mul(expectedAmount).div(1000);
    uint256 assetManagerCommission = dataUint256["assetManagerCommissionBP"].mul(expectedAmount).div(1000);
    uint256 naymsCommission = dataUint256["naymsCommissionBP"].mul(expectedAmount).div(1000);

    // add to commission balances
    dataUint256["brokerCommissionBalance"] = dataUint256["brokerCommissionBalance"].add(brokerCommission);
    dataUint256["assetManagerCommissionBalance"] = dataUint256["assetManagerCommissionBalance"].add(assetManagerCommission);
    dataUint256["naymsCommissionBalance"] = dataUint256["naymsCommissionBalance"].add(naymsCommission);

    // add to tranch balance
    uint256 tranchBalanceDelta = expectedAmount.sub(brokerCommission.add(assetManagerCommission).add(naymsCommission));
    dataUint256[__i(_index, "balance")] = dataUint256[__i(_index, "balance")].add(tranchBalanceDelta);
  }

  function getAssetManagerCommissionBalance () public view returns (uint256) {
    return dataUint256["assetManagerCommissionBalance"];
  }

  function getNaymsCommissionBalance () public view returns (uint256) {
    return dataUint256["naymsCommissionBalance"];
  }

  function getBrokerCommissionBalance () public view returns (uint256) {
    return dataUint256["brokerCommissionBalance"];
  }

  function getNumberOfClaims () public view returns (uint256) {
    return dataUint256["claimsCount"];
  }

  function getNumberOfPendingClaims () public view returns (uint256) {
    return dataUint256["claimsPendingCount"];
  }

  function getClaimInfo (uint256 _claimIndex) public view returns (
    uint256 amount_,
    uint256 tranchIndex_,
    bool approved_,
    bool declined_,
    bool paid_
  ) {
    amount_ = dataUint256[__i(_claimIndex, "claimAmount")];
    tranchIndex_ = dataUint256[__i(_claimIndex, "claimTranch")];
    approved_ = dataBool[__i(_claimIndex, "claimApproved")];
    declined_ = dataBool[__i(_claimIndex, "claimDeclined")];
    paid_ = dataBool[__i(_claimIndex, "claimPaid")];
  }

  function initiationDateHasPassed () public view returns (bool) {
    return now >= dataUint256["initiationDate"];
  }

  function startDateHasPassed () public view returns (bool) {
    return now >= dataUint256["startDate"];
  }

  function maturationDateHasPassed () public view returns (bool) {
    return now >= dataUint256["maturationDate"];
  }

  // heartbeat function!
  function checkAndUpdateState() public {
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

  function makeClaim(uint256 _index, address _clientManagerEntity, uint256 _amount) public {
    _mutations().dcall(abi.encodeWithSelector(
      "makeClaim(uint256,address,uint256)".dsig(),
      _index, _clientManagerEntity, _amount
    ));
  }


  function approveClaim(uint256 _claimIndex) public {
    _mutations().dcall(abi.encodeWithSelector(
      "approveClaim(uint256)".dsig(),
      _claimIndex
    ));
  }


  function declineClaim(uint256 _claimIndex) public {
    _mutations().dcall(abi.encodeWithSelector(
      "declineClaim(uint256)".dsig(),
      _claimIndex
    ));
  }


  function payClaims() public {
    _mutations().dcall(abi.encodeWithSelector(
      "payClaims()".dsig()
    ));
  }


  function payCommissions (
    address _assetManagerEntity, address _assetManager,
    address _brokerEntity, address _broker
  ) public {
    _mutations().dcall(abi.encodeWithSelector(
      "payCommissions(address,address,address,address)".dsig(),
      _assetManagerEntity, _assetManager, _brokerEntity, _broker
    ));
  }


  function calculateMaxNumOfPremiums() public view returns (uint256) {
    // first 2 payments + (endDate - startDate) / paymentInterval - 1
    return (dataUint256["maturationDate"] - dataUint256["initiationDate"]) / dataUint256["premiumIntervalSeconds"] + 1;
  }

  // TranchTokenImpl - queries //

  function tknName(uint256 _index) public view returns (string memory) {
    return string(abi.encodePacked(address(this).toString(), "_tranch_", _index));
  }

  function tknSymbol(uint256 _index) public view returns (string memory) {
    return tknName(_index);
  }

  function tknTotalSupply(uint256 _index) public view returns (uint256) {
    string memory numSharesKey = __i(_index, "numShares");
    return dataUint256[numSharesKey];
  }

  function tknBalanceOf(uint256 _index, address _owner) public view returns (uint256) {
    string memory k = __ia(_index, _owner, "balance");
    return dataUint256[k];
  }

  function tknAllowance(uint256 _index, address _spender, address _owner) public view returns (uint256) {
    string memory k = __iaa(_index, _owner, _spender, "allowance");
    return dataUint256[k];
  }

  // TranchTokenImpl - ERC20 mutations //

  function tknApprove(uint256 /*_index*/, address _spender, address /*_from*/, uint256 /*_value*/) public {
    require(_spender == settings().getMatchingMarket(), 'only nayms market is allowed to transfer');
  }

  function tknTransfer(uint256 _index, address _spender, address _from, address _to, uint256 _value) public {
    require(_spender == settings().getMatchingMarket(), 'only nayms market is allowed to transfer');
    _transfer(_index, _from, _to, _value);
  }

  // Internal functions

  function _transfer(uint _index, address _from, address _to, uint256 _value) private {
    // when token holder is sending to the market
    address market = settings().getMatchingMarket();
    if (market == _to) {
      // and they're not the initial balance holder of the token (i.e. the policy/tranch)
      address initialHolder = dataAddress[__i(_index, "initialHolder")];
      if (initialHolder != _from) {
        // then they must be a trader, in which case ony allow this if the policy is active
        require(dataUint256["state"] == POLICY_STATE_ACTIVE, 'can only trade when policy is active');
      }
    }

    string memory fromKey = __ia(_index, _from, "balance");
    string memory toKey = __ia(_index, _to, "balance");

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);

    // if we are in the initial sale period and this is a transfer from the market to a buyer
    if (dataUint256[__i(_index, "state")] == TRANCH_STATE_SELLING && market == _from) {
      // record how many "shares" were sold
      dataUint256[__i(_index, "sharesSold")] = dataUint256[__i(_index, "sharesSold")].add(_value);
      // update tranch balance
      dataUint256[__i(_index, "balance")] = dataUint256[__i(_index, "balance")].add(_value * dataUint256[__i(_index, "pricePerShareAmount")]);

      // if the tranch has fully sold out (i.e market no longer holds any tranch tokens)
      if (dataUint256[fromKey] == 0) {
        // flip tranch state to ACTIVE
        dataUint256[__i(_index, "state")] = TRANCH_STATE_ACTIVE;
        // clear offer id (market has already deleted offer since it has been fulfilled)
        dataUint256[__i(_index, "initialSaleOfferId")] = 0;
      }
    }
  }

  function _cancelTranchMarketOffer(uint _index) private {
    IMarket market = IMarket(settings().getMatchingMarket());

    uint256 initialSaleOfferId = dataUint256[__i(_index, "initialSaleOfferId")];

    if (market.isActive(initialSaleOfferId)) {
      market.cancel(initialSaleOfferId);
    }

    dataUint256[__i(_index, "initialSaleOfferId")] = 0;
  }


  function _beginPolicySaleIfNotYetStarted() private {
    if (dataUint256["state"] == POLICY_STATE_CREATED) {
      IMarket market = IMarket(settings().getMatchingMarket());

      // check every tranch
      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        require(0 >= _getNumberOfTranchPaymentsMissed(i), 'tranch premiums are not up-to-date');

        // tranch/token address
        address tranchAddress = dataAddress[__i(i, "address")];
        // initial token holder must be contract address
        address initialHolder = dataAddress[__i(i, "initialHolder")];
        require(initialHolder == address(this), "initial holder must be policy contract");
        // get supply
        uint256 totalSupply = tknTotalSupply(i);
        // calculate sale values
        uint256 pricePerShare = dataUint256[__i(i, "pricePerShareAmount")];
        uint256 totalPrice = totalSupply.mul(pricePerShare);
        // offer tokens in initial sale
        dataUint256[__i(i, "initialSaleOfferId")] = market.offer(
          totalSupply, tranchAddress, totalPrice, dataAddress["unit"], 0, false
        );
        // set tranch state
        dataUint256[__i(i, "state")] = TRANCH_STATE_SELLING;
      }

      // set policy state to PENDING
      dataUint256["state"] = POLICY_STATE_SELLING;

      emit BeginSale(address(this), msg.sender);
    }
  }

  function _activatePolicyIfPending() private {
    // make policy active if necessary
    if (dataUint256["state"] == POLICY_STATE_SELLING) {
      dataUint256["state"] = POLICY_STATE_ACTIVE;
      emit PolicyActive(address(this), msg.sender);
    }
  }

  function _ensureTranchesAreUpToDate() private {
    // check state of each tranch
    for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
      uint256 state = dataUint256[__i(i, "state")];

      // if tranch not yet fully sold OR if a payment has been missed
      if (state == TRANCH_STATE_SELLING || 0 < _getNumberOfTranchPaymentsMissed(i)) {
        // cancel any outstanding market order
        _cancelTranchMarketOffer(i);
        // set state to cancelled
        dataUint256[__i(i, "state")] = TRANCH_STATE_CANCELLED;
      }
    }
  }


  function _closePolicy () private {
    if (dataUint256["state"] != POLICY_STATE_MATURED) {
      dataUint256["state"] = POLICY_STATE_MATURED;
    }

    // if no pending claims AND we haven't yet initiated tranch buyback
    if (0 == getNumberOfPendingClaims() && !dataBool["buybackInitiated"]) {
      dataBool["buybackInitiated"] = true;

      address marketAddress = settings().getMatchingMarket();

      IMarket market = IMarket(marketAddress);

      // buy back all tranch tokens
      for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
        if (dataUint256[__i(i, "state")] == TRANCH_STATE_ACTIVE) {
          dataUint256[__i(i, "state")] = TRANCH_STATE_MATURED;
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

  function _getNextTranchPremiumAmount (uint256 _index) private view returns (uint256) {
    uint256[] storage premiums = dataManyUint256[__i(_index, "premiums")];
    uint256 numPremiumsAlreadyPaid = dataUint256[__i(_index, "premiumsPaid")];

    if (numPremiumsAlreadyPaid >= premiums.length) {
      return 0;
    } else {
      return premiums[numPremiumsAlreadyPaid];
    }
  }

  function _getNumberOfTranchPaymentsMissed (uint256 _index) private view returns (uint256) {
    uint256 expectedPaid = 0;

    // if inititation date has passed
    if (initiationDateHasPassed()) {
      expectedPaid++;

      // calculate the extra payments that should have been made by now
      uint256 diff = now.sub(dataUint256["initiationDate"]).div(dataUint256["premiumIntervalSeconds"]);
      expectedPaid = expectedPaid.add(diff);
    }

    // cap to no .of available premiums
    uint256[] storage premiums = dataManyUint256[__i(_index, "premiums")];

    if (expectedPaid > premiums.length) {
      expectedPaid = premiums.length;
    }

    uint256 premiumsPaid = dataUint256[__i(_index, "premiumsPaid")];

    if (expectedPaid >= premiumsPaid) {
      return expectedPaid.sub(premiumsPaid);
    } else {
      return 0;
    }
  }

  function _tranchPaymentsAllMade (uint256 _index) private view returns (bool) {
    uint256[] storage premiums = dataManyUint256[__i(_index, "premiums")];
    uint256 done = dataUint256[__i(_index, "premiumsPaid")];

    return (done >= premiums.length);
  }

  // Sub-delegates

  function _mutations () private view returns (address) {
    return settings().getPolicyMutations();
  }
}
