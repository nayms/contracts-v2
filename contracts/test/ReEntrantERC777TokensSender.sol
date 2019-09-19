pragma solidity >=0.5.8;

import '../base/ERC1820ImplementerInterface.sol';
import '../base/IERC777Sender.sol';
import '../base/TranchTokenImpl.sol';

contract ReEntrantERC777TokensSender is ERC1820ImplementerInterface, IERC777Sender {
  uint index;
  TranchTokenImpl tokenImpl;

  constructor (address _token, uint256 _index) public {
    index = _index;
    tokenImpl = TranchTokenImpl(_token);
  }

  function tokensToSend(
    address /*operator*/,
    address from,
    address to,
    uint256 amount,
    bytes memory userData,
    bytes memory /*operatorData*/
  ) public {
    tokenImpl.tknSend(
      index,
      from,
      to,
      amount,
      userData
    );
  }
}
