pragma solidity >=0.6.7;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IEntityTokenImplFacet.sol";
import "./base/PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/Address.sol";
import "./base/SafeMath.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Entity tokens
 */
contract EntityTokenImplFacet is EternalStorage, Controller, IDiamondFacet, IEntityTokenImplFacet {
  using SafeMath for uint;
  using Address for address;

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
      IEntityTokenImplFacet.tknName.selector,
      IEntityTokenImplFacet.tknSymbol.selector,
      IEntityTokenImplFacet.tknTotalSupply.selector,
      IEntityTokenImplFacet.tknBalanceOf.selector,
      IEntityTokenImplFacet.tknAllowance.selector,
      IEntityTokenImplFacet.tknApprove.selector,
      IEntityTokenImplFacet.tknTransfer.selector,
      IEntityTokenImplFacet.tknMint.selector,
      IEntityTokenImplFacet.tknBurn.selector
    );
  }

  // IEntityTokenImplFacet

  function tknName(address _asset) public view override returns (string memory) {
    return string(abi.encodePacked(address(this), IERC20(_asset).name()));
  }

  function tknSymbol(address _asset) public view override returns (string memory) {
    return string(abi.encodePacked(address(this), IERC20(_asset).symbol()));
  }

  function tknTotalSupply(address _asset) public view override returns (uint256) {
    return dataUint256[__a(_asset, "tknSupply")];
  }

  function tknBalanceOf(address _asset, address _owner) public view override returns (uint256) {
    string memory k = __aaa(_asset, _owner, address(0), "tknBalance");
    return dataUint256[k];
  }

  function tknAllowance(address _asset, address _spender, address _owner) public view override returns (uint256) {
    string memory k = __aaa(_asset, _owner, _spender, "tknAllowance");
    return dataUint256[k];
  }

  // Mutations

  function tknApprove(address _asset, address _spender, address _from, uint256 _value) public override {
    string memory k = __aaa(_asset, _from, _spender, "tknAllowance");
    dataUint256[k] = _value;
  }

  function tknTransfer(address _asset, address _spender, address _from, address _to, uint256 _value) public override {
    require(_spender == _from || tknAllowance(_asset, _spender, _from) >= _value, 'EntityToken: transfer amount exceeds allowance');
    _transfer(_asset, _from, _to, _value);
  }

  function tknMint(address _asset, address _minter, address _owner, uint256 _value) public override {
    require(_minter == address(this), 'only entity can mint tokens');

    string memory tsk = __a(_asset, "tknSupply");
    dataUint256[tsk] = dataUint256[tsk].add(_value);

    string memory k = __aaa(_asset, _owner, address(0), "tknBalance");
    dataUint256[k] = dataUint256[k].add(_value);
  }

  function tknBurn(address _asset, address _burner, address _owner, uint256 _value) public override {
    require(_burner == address(this), 'only entity can burn tokens');

    string memory tsk = __a(_asset, "tknSupply");
    dataUint256[tsk] = dataUint256[tsk].sub(_value);

    string memory k = __aaa(_asset, _owner, address(0), "tknBalance");
    dataUint256[k] = dataUint256[k].sub(_value);
  }

  // Internal functions

  function _transfer(address _asset, address _from, address _to, uint256 _value) private {
    string memory fromKey = __aaa(_asset, _from, address(0), "tknBalance");
    string memory toKey = __aaa(_asset, _to, address(0), "tknBalance");

    require(dataUint256[fromKey] >= _value, 'EntityToken: transfer amount exceeds balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);
  }
}
