pragma solidity >=0.5.8;

import "./IERC20.sol";
import "./SafeMath.sol";

/**
 * Represents Wrapped ETH, see https://blog.0xproject.com/canonical-weth-a9aa7d0279dd
 */
contract EtherToken is IERC20 {
  using SafeMath for *;

  mapping (address => uint256) private balances;
  mapping (address => mapping (address => uint256)) private allowances;
  string public constant name = "Ether Token";
  string public constant symbol = "ETH";
  uint8 public constant decimals = 18;
  uint256 public totalSupply;

  function balanceOf(address account) public view returns (uint256) {
      return balances[account];
  }

  function transfer(address recipient, uint256 amount) public returns (bool) {
      _transfer(msg.sender, recipient, amount);
      return true;
  }

  function allowance(address owner, address spender) public view returns (uint256) {
      return allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public returns (bool) {
      _approve(msg.sender, spender, amount);
      return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
      _transfer(sender, recipient, amount);
      _approve(sender, msg.sender, allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
      return true;
  }

  function _transfer(address sender, address recipient, uint256 amount) internal {
      require(sender != address(0), "ERC20: transfer from the zero address");
      require(recipient != address(0), "ERC20: transfer to the zero address");

      balances[sender] = balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
      balances[recipient] =balances[recipient].add(amount);
      emit Transfer(sender, recipient, amount);
  }

  function _approve(address owner, address spender, uint256 amount) internal {
      require(owner != address(0), "ERC20: approve from the zero address");
      require(spender != address(0), "ERC20: approve to the zero address");

      allowances[owner][spender] = amount;
      emit Approval(owner, spender, amount);
  }

  // From: https://github.com/gnosis/util-contracts/blob/master/contracts/EtherToken.sol

  event Deposit(address indexed sender, uint value);
  event Withdrawal(address indexed receiver, uint value);

  function deposit() public payable {
      balances[msg.sender] = balances[msg.sender].add(msg.value);
      totalSupply = totalSupply.add(msg.value);
      emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint value) public {
      // Balance covers value
      balances[msg.sender] = balances[msg.sender].sub(value);
      totalSupply = totalSupply.sub(value);
      msg.sender.transfer(value);
      emit Withdrawal(msg.sender, value);
  }
}
