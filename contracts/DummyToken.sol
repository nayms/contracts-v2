// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/IDummyToken.sol";
import "./base/PlatformToken.sol";

contract DummyToken is IDummyToken, PlatformToken {
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;
    string public override name;
    string public override symbol;
    uint8 public override decimals;
    uint256 public override totalSupply;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply,
        bool _isPlatformToken
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _initialSupply;
        balances[msg.sender] = _initialSupply;
        isPlatformToken = _isPlatformToken;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return balances[account];
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        unchecked {
            require(amount <= allowances[sender][msg.sender], "DummyToken: transfer amount exceeds allowance");
            _approve(sender, msg.sender, allowances[sender][msg.sender] - amount);
        }

        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        require(recipient != address(0), "DummyToken: transfer to the zero address");

        unchecked {
            require(amount <= balances[sender], "DummyToken: transfer amount exceeds balance");
            balances[sender] = balances[sender] - amount;
        }
        balances[recipient] = balances[recipient] + amount;
        emit Transfer(sender, recipient, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(spender != address(0), "DummyToken: approve to the zero address");

        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // IDummyToken

    function deposit() public payable override {
        balances[msg.sender] = balances[msg.sender] + msg.value;
        totalSupply = totalSupply + msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 value) public override {
        // Balance covers value
        unchecked {
            require(value <= balances[msg.sender], "DummyToken: insufficient balance");
            balances[msg.sender] = balances[msg.sender] - value;
        }
        totalSupply = totalSupply - value;
        payable(msg.sender).transfer(value);
        emit Withdrawal(msg.sender, value);
    }
}
