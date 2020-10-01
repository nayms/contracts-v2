pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityTokenMinterFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/Address.sol";
import "./base/SafeMath.sol";
import "./base/IERC20.sol";
import "./EntityToken.sol";

contract EntityTokenMinterFacet is EternalStorage, Controller, IEntityTokenMinterFacet, IDiamondFacet {
  using Address for address;
  using SafeMath for uint256;

  modifier assertCanRedeem () {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_ADMINS), 'must be entity admin');
    _;
  }

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
      IEntityTokenMinterFacet.getTokenAddress.selector,
      IEntityTokenMinterFacet.calculateTokensReceivable.selector,
      IEntityTokenMinterFacet.calculateAssetsRedeemable.selector,
      IEntityTokenMinterFacet.deposit.selector,
      IEntityTokenMinterFacet.redeem.selector
    );
  }

  // IEntityTokenMinterFacet

  function getTokenAddress(address _unit) public view override returns (address) {
    string memory key = __a(_unit, "token");
    return dataAddress[key];
  }

  function calculateTokensReceivable(address _unit, uint256 _amount) public view override returns (uint256) {
    address a = getTokenAddress(_unit);
    // if token has not yet been created
    if (a == address(0)) {
      // if there is already some amount of the _unit asset being held by the entity then this means that 
      // the depositor will end up in profit already!
      return _amount;
    }
    // calculate based on current balance and tokens already minted 
    else {
      IERC20 tok = IERC20(_unit);
      uint256 b = tok.balanceOf(address(this));
      IERC20 entityTok = IERC20(a);
      uint256 n = entityTok.totalSupply();
      return b.mul(_amount).div(n);
    }
  }

  function calculateAssetsRedeemable(address _token, uint256 _amount) public view override returns (uint256) {
    address unit = EntityToken(_token).asset();
    IERC20 tok = IERC20(unit);
    uint256 b = tok.balanceOf(address(this));

    IERC20 entityTok = IERC20(_token);
    uint256 n = entityTok.totalSupply();

    return b.mul(_amount).div(n);
  }

  function deposit(address _unit, uint256 _amount) public override {
    uint256 recvAmount = calculateTokensReceivable(_unit, _amount);

    address a = getTokenAddress(_unit);
    EntityToken e;

    // if token has not yet been created
    if (a == address(0)) {
      e = new EntityToken(address(this), _unit);
      _setTokenAddress(_unit, address(e));
    } else {
      e = EntityToken(a);
    }

    // take deposit
    IERC20(_unit).transferFrom(msg.sender, address(this), _amount);

    // mint tokens
    e.mint(recvAmount);
    e.transfer(msg.sender, recvAmount);
  }

  function redeem(address _token, uint256 _amount) public override assertCanRedeem {
    uint256 recvAmount = calculateAssetsRedeemable(_token, _amount);
    EntityToken e = EntityToken(_token);
    
    // burn
    e.burn(msg.sender, _amount);

    // withdraw asset
    address unit = e.asset();
    IERC20(unit).transfer(msg.sender, recvAmount);
  }
  
  // Internal methods

  function _setTokenAddress(address _unit, address _token) private {
    string memory key = __a(_unit, "token");
    dataAddress[key] = _token;
  }
}
