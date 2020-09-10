pragma solidity >=0.6.7;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IEntityTokensFacet.sol";
import "./base/PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/SafeMath.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Entity tokens
 */
contract EntityTokensFacet is EternalStorage, Controller, IDiamondFacet, IEntityTokensFacet {
  using SafeMath for uint;

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
      IEntityTokensFacet.tknName.selector,
      IEntityTokensFacet.tknSymbol.selector,
      IEntityTokensFacet.tknTotalSupply.selector,
      IEntityTokensFacet.tknBalanceOf.selector,
      IEntityTokensFacet.tknAllowance.selector,
      IEntityTokensFacet.tknApprove.selector,
      IEntityTokensFacet.tknTransfer.selector,
      IEntityTokensFacet.tknMint.selector
    );
  }

  // IEntityTokensFacet

  function tknName() public view override returns (string memory) {
    return string(abi.encodePacked(address(this).toString(), "tknName"));
  }

  function tknSymbol() public view override returns (string memory) {
    return tknName();
  }

  function tknTotalSupply() public view override returns (uint256) {
    return dataUint256["tknSupply"];
  }

  function tknBalanceOf(address _owner) public view override returns (uint256) {
    string memory k = __ia(0, _owner, "tknBalance");
    return dataUint256[k];
  }

  function tknAllowance(address _spender, address _owner) public view override returns (uint256) {
    string memory k = __iaa(0, _owner, _spender, "tknAllowance");
    return dataUint256[k];
  }

  // Mutations

  function tknApprove(address _spender, address _from, uint256 _value) public override {
    string memory k = __iaa(0, _from, _spender, "tknAllowance");
    dataUint256[k] = _value;
  }

  function tknTransfer(address _spender, address _from, address _to, uint256 _value) public override {
    require(_spender == _from || tknAllowance(_spender, _from) >= _value, 'not allowed');
    _transfer(_from, _to, _value);
  }

  function tknMint(address _minter, uint256 _value) public override {
    require(_minter == address(this), 'only entity can mint tokens');
    dataUint256["tknSupply"] = dataUint256["tknSupply"].add(_value);
    string memory k = __ia(0, _minter, "tknBalance");
    dataUint256[k] = dataUint256[k].add(_value);
  }

  // Internal functions

  function _transfer(address _from, address _to, uint256 _value) private {
    string memory fromKey = __ia(0, _from, "tknBalance");
    string memory toKey = __ia(0, _to, "tknBalance");

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);
  }
}
