pragma solidity >=0.5.8;

import "./Controller.sol";

/**
 * @title Destructible
 * @dev Base contract that can be destroyed by owner. All funds in contract will be sent to the owner.
 */
contract Destructible is Controller {
  constructor(address _acl, address _settings) Controller(_acl, _settings) public { }

  /**
   * @dev Transfers the current balance to the sender and terminates the contract.
   */
  function destroy()
    public
    assertIsAdmin
  {
    selfdestruct(msg.sender);
  }
}
