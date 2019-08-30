pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/EternalStorage.sol";
import "./base/IProxyImpl.sol";
import "./base/IFUCImpl.sol";
import "./base/TranchTokenImpl.sol";
import "./base/SafeMath.sol";
import "./FUCTranch.sol";

/**
 * @dev Business-logic for FUC
 */
contract FUCImpl is EternalStorage, AccessControl, IProxyImpl, IFUCImpl, TranchTokenImpl {
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

  // TranchTokenImpl //

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

  function tknApprove(uint256 _index, address _caller, address _spender, uint256 _value) public {
    string memory k = string(abi.encodePacked(_index, _caller, _spender, "allowance"));
    dataUint256[k] = _value;
  }

  function tknTransfer(uint256 _index, address _caller, address _to, uint256 _value) public {
    string memory fromKey = string(abi.encodePacked(_index, _caller, "balance"));
    string memory toKey = string(abi.encodePacked(_index, _to, "balance"));

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = SafeMath.sub(dataUint256[fromKey], _value);
    dataUint256[toKey] = SafeMath.add(dataUint256[toKey], _value);
  }

  function tknTransferFrom(uint256 _index, address _caller, address _from, address _to, uint256 _value) public {
    string memory k = string(abi.encodePacked(_index, _from, _caller, "allowance"));
    require(dataUint256[k] >= _value, 'unauthorized');
    tknTransfer(_index, _from, _to, _value);
  }
}
