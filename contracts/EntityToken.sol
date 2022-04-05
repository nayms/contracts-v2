// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/IERC20.sol";
import "./base/IEntityTokensFacet.sol";
import "./base/PlatformToken.sol";

/**
 * @dev An entity token.
 */
contract EntityToken is IERC20, PlatformToken {
    IEntityTokensFacet public impl;
    address unit;

    constructor(address _impl, address _unit) {
        impl = IEntityTokensFacet(_impl);
        unit = _unit;
    }

    // ERC-20 queries //

    function name() public view override returns (string memory) {
        return impl.tknName(unit);
    }

    function symbol() public view override returns (string memory) {
        return impl.tknSymbol(unit);
    }

    function totalSupply() public view override returns (uint256) {
        return impl.tknTotalSupply(unit);
    }

    function balanceOf(address owner) public view override returns (uint256) {
        return impl.tknBalanceOf(unit, owner);
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return impl.tknAllowance(unit, spender, owner);
    }

    // ERC-20 mutations //

    function approve(address spender, uint256 value) public override returns (bool) {
        impl.tknApprove(unit, spender, msg.sender, value);
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        impl.tknTransfer(unit, msg.sender, msg.sender, to, value);
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override returns (bool) {
        impl.tknTransfer(unit, msg.sender, from, to, value);
        emit Transfer(from, to, value);
        return true;
    }
}
