pragma solidity 0.6.12;

import "./Controller.sol";

/**
 * @dev Base contract that can be destroyed by owner. All funds in contract will be sent to the owner.
 */
contract Destructible is Controller {
  /**
   * @dev Constructor.
   * @param _settings Settings address.
   */
  constructor(address _settings) Controller(_settings) public {
    // empty
  }

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
