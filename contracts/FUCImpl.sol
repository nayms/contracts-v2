pragma solidity >=0.5.8;

import "./base/Address.sol";
import "./base/AccessControl.sol";
import "./base/EternalStorage.sol";
import './base/IERC777Sender.sol';
import './base/IERC777Recipient.sol';
import './base/IERC1820Registry.sol';
import "./base/IProxyImpl.sol";
import "./base/IFUCImpl.sol";
import "./base/TranchTokenImpl.sol";
import "./base/SafeMath.sol";
import "./FUCTranch.sol";

/**
 * @dev Business-logic for FUC
 */
contract FUCImpl is EternalStorage, AccessControl, IProxyImpl, IFUCImpl, TranchTokenImpl {
  using Address for address;

  /*
    Following ERC-1820 stuff is from:
    - https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC777/ERC777.sol
    - https://eips.ethereum.org/EIPS/eip-1820
   */
  IERC1820Registry private erc1820Registry = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
  // keccak256("ERC777TokensSender")
  bytes32 constant private TOKENS_SENDER_INTERFACE_HASH =
      0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895;
  // keccak256("ERC777TokensRecipient")
  bytes32 constant private TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  /**
   * Constructor
   */
  constructor (address _acl, string memory _aclContext)
    AccessControl(_acl, _aclContext)
    public
  {}

  // IProxyImpl //

  function getImplementationVersion () pure public returns (string memory) {
    return "v1";
  }

  // IFUCImpl //

  function setName (string memory _name) assertIsAssetManagerAgent public {
    dataString["name"] = _name;
  }

  function getName () public view returns (string memory) {
    return dataString["name"];
  }

  function createTranches (
    uint256 _numTranches,
    uint256[] memory _tranchNumShares,
    uint256[] memory _tranchInitialPricePerShare
  ) public {
    require(_numTranches > 0, 'need atleast 1 tranch');
    require(_tranchNumShares.length == _numTranches, 'num-shares array length mismatch');
    require(_tranchInitialPricePerShare.length == _numTranches, 'price-per-share array length mismatch');

    // instantiate tranches
    uint256 existingNumTranches = dataUint256["numTranches"];

    dataUint256["numTranches"] = existingNumTranches + _numTranches;

    for (uint256 i = existingNumTranches; i < dataUint256["numTranches"]; i++) {
      // setup initial data for tranch
      string memory numSharesKey = string(abi.encodePacked(i, "numShares"));
      string memory pricePerShareKey = string(abi.encodePacked(i, "pricePerShare"));
      dataUint256[numSharesKey] = _tranchNumShares[i - existingNumTranches];
      dataUint256[pricePerShareKey] = _tranchInitialPricePerShare[i - existingNumTranches];
      // sender holds all shares initially
      string memory initialOwnerBalanceKey = string(abi.encodePacked(i, msg.sender, "balance"));
      dataUint256[initialOwnerBalanceKey] = dataUint256[numSharesKey];
      // deploy token contract
      FUCTranch t = new FUCTranch(address(this), i);
      // save reference
      string memory addressKey = string(abi.encodePacked(i, "address"));
      dataAddress[addressKey] = address(t);
    }
  }

  function getNumTranches () public view returns (uint256) {
    return dataUint256["numTranches"];
  }

  function getTranch (uint256 _index) public view returns (address) {
    string memory addressKey = string(abi.encodePacked(_index, "address"));
    return dataAddress[addressKey];
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

  function tknAllowance(uint256 _index, address _owner, address _spender) public view returns (uint256) {
    string memory k = string(abi.encodePacked(_index, _owner, _spender, "allowance"));
    return dataUint256[k];
  }

  function tknIsOperatorFor(uint256 _index, address _operator, address _tokenHolder) public view returns (bool) {
    string memory k = string(abi.encodePacked(_index, _tokenHolder, _operator, "operator"));
    return dataBool[k];
  }

  // TranchTokenImpl - ERC20 mutations //

  function tknApprove(uint256 _index, address _caller, address _spender, uint256 _value) public {
    string memory k = string(abi.encodePacked(_index, _caller, _spender, "allowance"));
    dataUint256[k] = _value;
  }

  function tknTransfer(uint256 _index, address _caller, address _to, uint256 _value) public {
    _transfer(_index, _caller, _to, _value);
  }

  function tknTransferFrom(uint256 _index, address _caller, address _from, address _to, uint256 _value) public {
    string memory k = string(abi.encodePacked(_index, _from, _caller, "allowance"));
    require(dataUint256[k] >= _value, 'unauthorized');
    tknTransfer(_index, _from, _to, _value);
  }

  // TranchTokenImpl - ERC777 mutations //

  function tknAuthorizeOperator(uint256 _index, address _tokenHolder, address _operator) public {
    string memory k = string(abi.encodePacked(_index, _tokenHolder, _operator, "operator"));
    dataBool[k] = true;
  }

  function tknRevokeOperator(uint256 _index, address _tokenHolder, address _operator) public {
    string memory k = string(abi.encodePacked(_index, _tokenHolder, _operator, "operator"));
    dataBool[k] = false;
  }

  function tknSend(uint256 _index, address _sender, address _recipient, uint256 _amount, bytes memory _data) public {
    require(_recipient != address(0), 'cannot send to zero address');

    _callTokensToSend(_index, _sender, _sender, _recipient, _amount, _data, "");

    _transfer(_index, _sender, _recipient, _amount);

    _callTokensReceived(_index, _sender, _sender, _recipient, _amount, _data, "");
  }

  function tknOperatorSend(uint256 _index, address _operator, address _sender, address _recipient, uint256 _amount, bytes memory _data, bytes memory _operatorData) public {
    require(_recipient != address(0), 'cannot send to zero address');

    string memory k = string(abi.encodePacked(_index, _sender, _operator, "operator"));
    require(dataBool[k], 'not authorized');

    _callTokensToSend(_index, _sender, _sender, _recipient, _amount, _data, _operatorData);

    _transfer(_index, _sender, _recipient, _amount);

    _callTokensReceived(_index, _sender, _sender, _recipient, _amount, _data, _operatorData);
  }

  // Helpers

  function _transfer(uint _index, address _from, address _to, uint256 _value) private {
    string memory fromKey = string(abi.encodePacked(_index, _from, "balance"));
    string memory toKey = string(abi.encodePacked(_index, _to, "balance"));

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = SafeMath.sub(dataUint256[fromKey], _value);
    dataUint256[toKey] = SafeMath.add(dataUint256[toKey], _value);
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
    acquireErc777SenderMutex(_index)
    private
  {
    address implementer = erc1820Registry.getInterfaceImplementer(_from, TOKENS_SENDER_INTERFACE_HASH);
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
    acquireErc777ReceiverMutex(_index)
    private
  {
    address implementer = erc1820Registry.getInterfaceImplementer(_to, TOKENS_RECIPIENT_INTERFACE_HASH);
    if (implementer != address(0)) {
      IERC777Recipient(implementer).tokensReceived(_operator, _from, _to, _amount, _userData, _operatorData);
    } else {
      require(!_to.isContract(), "token recipient contract has no implementer for ERC777TokensRecipient");
    }
  }
}
