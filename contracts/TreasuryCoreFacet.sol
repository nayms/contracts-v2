pragma solidity 0.6.12;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/ITreasuryCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/SafeMath.sol";

contract TreasuryCoreFacet is EternalStorage, Controller, ITreasuryCoreFacet, IDiamondFacet {
  using SafeMath for uint256;

  modifier assertIsRegistered (address _addr) {
    require(_isRegistered(_addr), "not registered with treasury");
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      ITreasuryCoreFacet.register.selector,
      ITreasuryCoreFacet.transferTo.selector,
      ITreasuryCoreFacet.incBalance.selector
    );
  }


  // ITreasuryCoreFacet

  function register() external override {
    dataBool[__a(msg.sender, "registered")] = true;
  }

  function transferTo (address _token, address _recipient, uint256 _amount) 
    external 
    override 
    assertIsRegistered(msg.sender)
  {
    // update balance
    uint256 bal = _getBal(msg.sender, _token);
    require(bal >= _amount, "not enough balance");
    _setBal(msg.sender, _token, bal.sub(_amount));

    // internal transfer
    if (_isRegistered(_recipient)) {
      _setBal(_recipient, _token, _getBal(_recipient, _token).add(_amount));
    } 
    // external transfer
    else {
      IERC20(_token).transfer(_recipient, _amount);
    }
  }

  function incBalance (address _token, uint256 _amount) 
    external 
    override 
    assertIsRegistered(msg.sender)
  {
    _setBal(msg.sender, _token, _getBal(msg.sender, _token).add(_amount));
  }

  // Private methods

  function _getBal(address _addr, address _token) private view returns (uint256) {
    return dataUint256[__iaa(0, _addr, _token, "balance")];
  }

  function _setBal(address _addr, address _token, uint256 _val) private {
    dataUint256[__iaa(0, _addr, _token, "balance")] = _val;
  }

  function _isRegistered(address _addr) private view returns (bool) {
    return dataBool[__a(_addr, "registered")];
  }
}
