// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.9;
import "forge-std/Test.sol";
import "forge-std/Vm.sol";
import "ds-test/test.sol";

import { IERC20 } from "../../../contracts/base/IERC20.sol";

// interface IERC20 {
//     function balanceOf(address) external view returns (uint256);
// }

contract DSTestPlusF is Test {
    using stdStorage for StdStorage;

    function writeTokenBalance(
        address who,
        address token,
        uint256 amt
    ) internal {
        stdstore.target(token).sig(IERC20(token).balanceOf.selector).with_key(who).checked_write(amt);
    }

    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize > 0, _errorMessage);
    }
}
