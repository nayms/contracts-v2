pragma solidity >=0.5.8;

import '../base/ERC1820ImplementerInterface.sol';
import '../base/IERC777Sender.sol';

contract DummyERC777TokensSender is ERC1820ImplementerInterface, IERC777Sender {
  event TokensToSend(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256 amount,
    bytes userData,
    bytes operatorData
  );

  function tokensToSend(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes memory userData,
    bytes memory operatorData
  ) public {
    emit TokensToSend(
      operator,
      from,
      to,
      amount,
      userData,
      operatorData
    );
  }
}
