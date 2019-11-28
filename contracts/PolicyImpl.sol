pragma solidity >=0.5.8;

import "./base/Address.sol";
import "./base/AccessControl.sol";
import "./base/EternalStorage.sol";
import './base/IERC777Sender.sol';
import './base/IERC777Recipient.sol';
import './base/IERC1820Registry.sol';
import "./base/IProxyImpl.sol";
import "./base/IPolicyImpl.sol";
import "./base/IMarket.sol";
import "./base/ITranchToken.sol";
import "./base/SafeMath.sol";
import "./PolicyTranch.sol";

/**
 * @dev Business-logic for Policy
 */
contract PolicyImpl is EternalStorage, AccessControl, IProxyImpl, IPolicyImpl, ITranchToken {
  using SafeMath for uint;
  using Address for address;

  /* ERC 1820 stuff */
  address private constant ERC1820_REGISTRY_ADDRESS =
      0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;
  // keccak256("ERC777TokensSender")
  bytes32 private constant TOKENS_SENDER_INTERFACE_HASH =
      0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895;
  // keccak256("ERC777TokensRecipient")
  bytes32 private constant TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  /**
   * Constructor
   */
  constructor (address _acl, string memory _aclContext)
    AccessControl(_acl, _aclContext)
    public
  {}

  // IProxyImpl //

  function getImplementationVersion () public pure returns (string memory) {
    return "v1";
  }

  // IPolicyImpl //

  function setName (string memory _name)
    public
    assertInRoleGroup(ROLEGROUP_MANAGE_POLICY)
  {
    dataString["name"] = _name;
  }

  function getName () public view returns (string memory) {
    return dataString["name"];
  }

  function createTranch (
    uint256 _numShares,
    uint256 _initialPricePerShare,
    address _initialPricePerShareUnit,
    address _initialBalanceHolder
  )
    public
    assertInRoleGroup(ROLEGROUP_MANAGE_POLICY)
    returns (uint256)
  {
    require(_numShares > 0, 'invalid num of shares');
    require(_initialPricePerShare > 0, 'invalid price');
    require(_initialPricePerShareUnit != address(0), 'invalid price unit');

    // instantiate tranches
    uint256 i = dataUint256["numTranches"];
    dataUint256["numTranches"] = i + 1;

    // setup initial data for tranch
    string memory numSharesKey = string(abi.encodePacked(i, "numShares"));
    string memory pricePerShareKey = string(abi.encodePacked(i, "pricePerShare"));
    string memory pricePerShareUnitKey = string(abi.encodePacked(i, "pricePerShareUnit"));
    dataUint256[numSharesKey] = _numShares;
    dataUint256[pricePerShareKey] = _initialPricePerShare;
    dataAddress[pricePerShareUnitKey] = _initialPricePerShareUnit;
    // deploy token contract
    PolicyTranch t = new PolicyTranch(address(this), i);
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

  function getTranch (uint256 _index) public view returns (address) {
    string memory addressKey = string(abi.encodePacked(_index, "address"));
    return dataAddress[addressKey];
  }

  function beginTranchSale(uint256 _index, address _market)
    public
    assertInRoleGroup(ROLEGROUP_APPROVE_POLICY)
  {
    // tranch/token address
    string memory addressKey = string(abi.encodePacked(_index, "address"));
    address tranchAddress = dataAddress[addressKey];
    // initial token holder must be contract address
    string memory initialHolderKey = string(abi.encodePacked(_index, "initialHolder"));
    address initialHolder = dataAddress[initialHolderKey];
    require(initialHolder == address(this), "initial holder must be policy contract");
    // check balance
    uint256 currentBalance = tknBalanceOf(_index, address(this));
    uint256 totalSupply = tknTotalSupply(_index);
    require(currentBalance == totalSupply, 'sale already started');
    // calculate sale values
    string memory pricePerShareKey = string(abi.encodePacked(_index, "pricePerShare"));
    string memory pricePerShareUnitKey = string(abi.encodePacked(_index, "pricePerShareUnit"));
    uint256 pricePerShare = dataUint256[pricePerShareKey];
    address unit = dataAddress[pricePerShareUnitKey];
    uint256 totalPrice = totalSupply.mul(pricePerShare);
    // approve the market to transfer tokens from tranch into market escrow
    tknApprove(_index, _market, initialHolder, totalSupply);
    // do the transfer
    IMarket mkt = IMarket(_market);
    mkt.offer(totalSupply, tranchAddress, totalPrice, unit, 0, false);

    // emit BeginTranchSale(_index, totalSupply, totalPrice, unit);
  }

  // TranchTokenImpl - queries //

  function tknName(uint256 _index) public view returns (string memory) {
    return string(abi.encodePacked(dataString["name"], "_tranch_", _index));
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

  function tknApprove(uint256 _index, address _spender, address _from, uint256 _value) public {
    string memory k = string(abi.encodePacked(_index, _from, "allowance", _spender));
    dataUint256[k] = _value;
  }

  function tknTransfer(uint256 _index, address _from, address _to, uint256 _value) public {
    _transfer(_index, _from, _to, _value);
  }

  function tknTransferFrom(uint256 _index, address _spender, address _from, address _to, uint256 _value) public {
    string memory k = string(abi.encodePacked(_index, _from, "allowance", _spender));
    require(dataUint256[k] >= _value, 'unauthorized');
    tknTransfer(_index, _from, _to, _value);
  }

  // TranchTokenImpl - ERC777 mutations //

  function tknAuthorizeOperator(uint256 _index, address _operator, address _tokenHolder) public {
    string memory k = string(abi.encodePacked(_index, _tokenHolder, "operator", _operator));
    dataBool[k] = true;
  }

  function tknRevokeOperator(uint256 _index, address _operator, address _tokenHolder) public {
    string memory k = string(abi.encodePacked(_index, _tokenHolder, "operator", _operator));
    dataBool[k] = false;
  }

  function tknSend(uint256 _index, address _from, address _to, uint256 _amount, bytes memory _data) public {
    require(_to != address(0), 'cannot send to zero address');

    _callTokensToSend(_index, _from, _from, _to, _amount, _data, "");

    _transfer(_index, _from, _to, _amount);

    _callTokensReceived(_index, _from, _from, _to, _amount, _data, "");
  }

  function tknOperatorSend(uint256 _index, address _operator, address _from, address _to, uint256 _amount, bytes memory _data,
    bytes memory _operatorData) public
  {
    require(_to != address(0), 'cannot send to zero address');

    string memory k = string(abi.encodePacked(_index, _from, "operator", _operator));
    require(dataBool[k], 'not authorized');

    _callTokensToSend(_index, _operator, _from, _to, _amount, _data, _operatorData);

    _transfer(_index, _from, _to, _amount);

    _callTokensReceived(_index, _operator, _from, _to, _amount, _data, _operatorData);
  }

  // Helpers

  function _transfer(uint _index, address _from, address _to, uint256 _value) private {
    string memory fromKey = string(abi.encodePacked(_index, _from, "balance"));
    string memory toKey = string(abi.encodePacked(_index, _to, "balance"));

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);
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
