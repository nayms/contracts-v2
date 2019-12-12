pragma solidity >=0.5.8;

import "./AccessControl.sol";

/**
 * @title Destructible
 * @dev Base contract that can be destroyed by owner. All funds in contract will be sent to the owner.
 */
contract Destructible is AccessControl {
  constructor(address _acl) AccessControl(_acl) public { }

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
