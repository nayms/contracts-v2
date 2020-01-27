pragma solidity >=0.5.8;

import "./base/Address.sol";
import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import './base/IERC777Sender.sol';
import './base/IERC777Recipient.sol';
import './base/IERC1820Registry.sol';
import "./base/IProxyImpl.sol";
import "./base/IPolicyImpl.sol";
import "./base/IMarket.sol";
import "./base/ITranchTokenHelper.sol";
import "./base/SafeMath.sol";
import "./TranchToken.sol";

/**
 * @dev Business-logic for Policy
 */
contract PolicyImpl is EternalStorage, Controller, IProxyImpl, IPolicyImpl, ITranchTokenHelper {
  using SafeMath for uint;
  using Address for address;

  // ERC 1820 stuff //

  address public constant ERC1820_REGISTRY_ADDRESS =
      0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;
  // keccak256("ERC777TokensSender")
  bytes32 public constant TOKENS_SENDER_INTERFACE_HASH =
      0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895;
  // keccak256("ERC777TokensRecipient")
  bytes32 public constant TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  // Modifiers //

  modifier assertCanManagePolicy () {
    require(inRoleGroupWithContext(dataString["entityContext"], msg.sender, ROLEGROUP_MANAGE_POLICY), 'must be policy manager');
    _;
  }

  modifier assertCanApprovePolicy () {
    require(inRoleGroup(msg.sender, ROLEGROUP_APPROVE_POLICY), 'must be policy approver');
    _;
  }

  modifier assertDraftState () {
    require(dataUint256["state"] == STATE_DRAFT, 'must be in draft state');
    _;
  }

  modifier assertPendingState () {
    require(dataUint256["state"] == STATE_PENDING, 'must be in pending state');
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
    uint256 _premiumAmount,
    address _initialBalanceHolder
  )
    public
    assertCanManagePolicy
    assertDraftState
    returns (uint256)
  {
    require(_numShares > 0, 'invalid num of shares');
    require(_pricePerShareAmount > 0, 'invalid price');
    require(_premiumAmount > 0, 'invalid premium');

    // instantiate tranches
    uint256 i = dataUint256["numTranches"];
    dataUint256["numTranches"] = i + 1;

    // setup initial data for tranch
    dataUint256[string(abi.encodePacked(i, "numShares"))] = _numShares;
    dataUint256[string(abi.encodePacked(i, "pricePerShareAmount"))] = _pricePerShareAmount;
    dataUint256[string(abi.encodePacked(i, "premiumAmount"))] = _premiumAmount;

    // deploy token contract
    TranchToken t = new TranchToken(address(this), i);

    // work out initial holder
    address holder = _initialBalanceHolder;
    if (holder == address(0)) {
      // by default it's this conract
      holder = address(this);
    }
    string memory initialHolderKey = string(abi.encodePacked(i, "initialHolder"));
    dataAddress[initialHolderKey] = holder;

    // set initial holder balance
    string memory contractBalanceKey = string(abi.encodePacked(i, dataAddress[initialHolderKey], "balance"));
    dataUint256[contractBalanceKey] = _numShares;

    // save reference
    string memory addressKey = string(abi.encodePacked(i, "address"));
    dataAddress[addressKey] = address(t);

    emit CreateTranch(address(this), address(t), dataAddress[initialHolderKey], i);

    return i;
  }

  function getNumTranches () public view returns (uint256) {
    return dataUint256["numTranches"];
  }

  function getTranchToken (uint256 _index) public view returns (address) {
    return dataAddress[string(abi.encodePacked(_index, "address"))];
  }

  function getTranchState (uint256 _index) public view returns (uint256) {
    return dataUint256[string(abi.encodePacked(_index, "state"))];
  }


  function beginSale()
    public
    assertCanApprovePolicy
    assertDraftState
  {
    // solhint-disable-next-line security/no-block-members
    require(now >= dataUint256["initiationDate"], 'not yet time to begin sale');
    // solhint-disable-next-line security/no-block-members
    require(now < dataUint256["startDate"], 'start date already passed');

    IMarket market = IMarket(settings().getMatchingMarket());

    for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
      // tranch/token address
      address tranchAddress = dataAddress[string(abi.encodePacked(i, "address"))];
      // initial token holder must be contract address
      address initialHolder = dataAddress[string(abi.encodePacked(i, "initialHolder"))];
      require(initialHolder == address(this), "initial holder must be policy contract");
      // get supply
      uint256 totalSupply = tknTotalSupply(i);
      // calculate sale values
      uint256 pricePerShare = dataUint256[string(abi.encodePacked(i, "pricePerShareAmount"))];
      uint256 totalPrice = totalSupply.mul(pricePerShare);
      // do the transfer
      market.offer(totalSupply, tranchAddress, totalPrice, dataAddress["unit"], 0, false);
      // set tranch state
      dataUint256[string(abi.encodePacked(i, "state"))] = STATE_PENDING;
    }

    dataUint256["state"] = STATE_PENDING;

    emit BeginSale(msg.sender);
  }


  function endSale()
    public
    assertCanApprovePolicy
    assertPendingState
  {
    // solhint-disable-next-line security/no-block-members
    require(now < dataUint256["startDate"], 'start date already passed');

    bool atleastOneActiveTranch = false;

    for (uint256 i = 0; dataUint256["numTranches"] > i; i += 1) {
      uint256 state = dataUint256[string(abi.encodePacked(i, "state"))];

      if (state == STATE_ACTIVE) {
        atleastOneActiveTranch = true;
      } else {
        dataUint256[string(abi.encodePacked(i, "state"))] = STATE_CANCELLED;
      }
    }

    if (atleastOneActiveTranch) {
      dataUint256["state"] = STATE_ACTIVE;
      emit PolicyActive(msg.sender);
    } else {
      dataUint256["state"] = STATE_CANCELLED;
      emit PolicyCancelled(msg.sender);
    }
  }


  // TranchTokenImpl - queries //

  function tknName(uint256 _index) public view returns (string memory) {
    return string(abi.encodePacked(address(this).toString(), "_tranch_", _index));
  }

  function tknSymbol(uint256 _index) public view returns (string memory) {
    return tknName(_index);
  }

  function tknTotalSupply(uint256 _index) public view returns (uint256) {
    string memory numSharesKey = string(abi.encodePacked(_index, "numShares"));
    return dataUint256[numSharesKey];
  }

  function tknBalanceOf(uint256 _index, address _owner) public view returns (uint256) {
    string memory k = string(abi.encodePacked(_index, _owner, "balance"));
    return dataUint256[k];
  }

  function tknAllowance(uint256 _index, address _spender, address _owner) public view returns (uint256) {
    string memory k = string(abi.encodePacked(_index, _owner, "allowance", _spender));
    return dataUint256[k];
  }

  function tknIsOperatorFor(uint256 _index, address _operator, address _tokenHolder) public view returns (bool) {
    string memory k = string(abi.encodePacked(_index, _tokenHolder, "operator", _operator));
    return dataBool[k];
  }

  // TranchTokenImpl - ERC20 mutations //

  function tknApprove(uint256 /*_index*/, address /*_spender*/, address /*_from*/, uint256 /*_value*/) public {
    revert('only nayms market is allowed to transfer');
  }

  function tknTransfer(uint256 _index, address _spender, address _from, address _to, uint256 _value) public {
    require(_spender == settings().getMatchingMarket(), 'only nayms market is allowed to transfer');
    _transfer(_index, _from, _to, _value);
  }

  // TranchTokenImpl - ERC777 mutations //

  function tknAuthorizeOperator(uint256 /*_index */, address /* _operator */, address /* _tokenHolder */) public {
    revert('only nayms market is allowed to transfer');
  }

  function tknRevokeOperator(uint256 /*_index */, address /* _operator */, address /* _tokenHolder */) public {
    revert('only nayms market is allowed to transfer');
  }

  function tknSend(uint256 _index, address _operator, address _from, address _to, uint256 _amount, bytes memory _data,
    bytes memory _operatorData) public
  {
    require(_to != address(0), 'cannot send to zero address');
    require(_operator == settings().getMatchingMarket(), 'only nayms market is allowed to transfer');

    _callTokensToSend(_index, _operator, _from, _to, _amount, _data, _operatorData);

    _transfer(_index, _from, _to, _amount);

    _callTokensReceived(_index, _operator, _from, _to, _amount, _data, _operatorData);
  }

  // Helpers

  function _transfer(uint _index, address _from, address _to, uint256 _value) private {
    // when token holder is sending to the market
    address market = settings().getMatchingMarket();
    if (market == _to) {
      // and they're not the initial balance holder of the token
      address initialHolder = dataAddress[string(abi.encodePacked(_index, "initialHolder"))];
      if (initialHolder != _from) {
        // then ony allow them to do this when policy is active
        require(dataUint256["state"] == STATE_ACTIVE, 'can only trade when policy is active');
      }
    }

    string memory fromKey = string(abi.encodePacked(_index, _from, "balance"));
    string memory toKey = string(abi.encodePacked(_index, _to, "balance"));

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);

    // if we are in the initial sale period and the tranch has fully sold out then flip its state to ACTIVE
    if (dataUint256[string(abi.encodePacked(_index, "state"))] == STATE_PENDING && dataUint256[fromKey] == 0) {
      dataUint256[string(abi.encodePacked(_index, "state"))] = STATE_ACTIVE;
    }
  }

  // re-entrancy protection
  modifier acquireErc777SenderMutex (uint256 _index) {
    string memory k = string(abi.encodePacked(_index, "erc777sender-mutex"));
    require(!dataBool[k], 'ERC777 sender mutex already acquired');
    dataBool[k] = true;
    _;
    dataBool[k] = false;
  }
  // re-entrancy protection
  modifier acquireErc777ReceiverMutex (uint256 _index) {
    string memory k = string(abi.encodePacked(_index, "erc777receiver-mutex"));
    require(!dataBool[k], 'ERC777 receiver mutex already acquired');
    dataBool[k] = true;
    _;
    dataBool[k] = false;
  }

  // From https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC777/ERC777.sol
  function _callTokensToSend(
    uint256 _index,
    address _operator,
    address _from,
    address _to,
    uint256 _amount,
    bytes memory _userData,
    bytes memory _operatorData
  )
    private
    acquireErc777SenderMutex(_index)
  {
    address implementer = IERC1820Registry(ERC1820_REGISTRY_ADDRESS).getInterfaceImplementer(_from, TOKENS_SENDER_INTERFACE_HASH);
    if (implementer != address(0)) {
      IERC777Sender(implementer).tokensToSend(_operator, _from, _to, _amount, _userData, _operatorData);
    }
  }

  // From https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC777/ERC777.sol
  function _callTokensReceived(
    uint256 _index,
    address _operator,
    address _from,
    address _to,
    uint256 _amount,
    bytes memory _userData,
    bytes memory _operatorData
  )
    private
    acquireErc777ReceiverMutex(_index)
  {
    address implementer = IERC1820Registry(ERC1820_REGISTRY_ADDRESS).getInterfaceImplementer(_to, TOKENS_RECIPIENT_INTERFACE_HASH);
    if (implementer != address(0)) {
      IERC777Recipient(implementer).tokensReceived(_operator, _from, _to, _amount, _userData, _operatorData);
    } else {
      require(!_to.isContract(), "token recipient contract has no implementer for ERC777TokensRecipient");
    }
  }
}
