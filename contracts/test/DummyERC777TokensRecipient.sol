pragma solidity >=0.5.8;

import '../base/ERC1820ImplementerInterface.sol';
import '../base/IERC777Recipient.sol';

contract DummyERC777TokensRecipient is ERC1820ImplementerInterface, IERC777Recipient {
  event TokensReceived(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256 amount,
    bytes userData,
    bytes operatorData
  );

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes memory userData,
    bytes memory operatorData
  ) public {
    emit TokensReceived(
      operator,
      from,
      to,
      amount,
      userData,
      operatorData
    );
  }
}
