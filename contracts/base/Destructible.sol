pragma solidity >=0.5.8;

import "./Controller.sol";

/**
 * @dev Base contract that can be destroyed by owner. All funds in contract will be sent to the owner.
 */
contract Destructible is Controller {
  constructor(address _acl, address _settings) Controller(_acl, _settings) public { }

  /**
   * @dev Destroy this contract and transfer the current ETH balance to the sender.
   */
  function destroy()
    public
    assertIsAdmin
  {
    selfdestruct(msg.sender);
  }
}
