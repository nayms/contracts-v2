pragma solidity >=0.6.7;

import './base/IERC20.sol';
import './base/IPolicyTranchTokensFacet.sol';

/**
 * @dev An Policy tranch.
 */
contract TranchToken is IERC20 {
  IPolicyTranchTokensFacet public impl;
  uint256 public index;

  constructor (address _impl, uint256 _index) public {
    impl = IPolicyTranchTokensFacet(_impl);
    index = _index;
  }

  // ERC-20 queries //

  function name() public view override returns (string memory) {
    return impl.tknName(index);
  }

  function symbol() public view override returns (string memory) {
    return impl.tknSymbol(index);
  }

  function totalSupply() public view override returns (uint256) {
    return impl.tknTotalSupply(index);
  }

  function balanceOf(address owner) public view override returns (uint256) {
    return impl.tknBalanceOf(index, owner);
  }

  function decimals() public view override returns (uint8) {
    return 18;
  }

  function allowance(address owner, address spender) public view override returns (uint256) {
    return impl.tknAllowance(index, spender, owner);
  }

  // ERC-20 mutations //

  function approve(address spender, uint256 value) public override returns (bool) {
    impl.tknApprove(index, spender, msg.sender, value);
    emit Approval(msg.sender, spender, value);
    return true;
  }

  function transfer(address to, uint256 value) public override returns (bool) {
    impl.tknTransfer(index, msg.sender, msg.sender, to, value);
    emit Transfer(msg.sender, to, value);
    return true;
  }

  function transferFrom(address from, address to, uint256 value) public override returns (bool) {
    impl.tknTransfer(index, msg.sender, from, to, value);
    emit Transfer(from, to, value);
    return true;
  }
}
