// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.12;

import "forge-std/stdlib.sol";
import "forge-std/Vm.sol";
import "ds-test/test.sol";
import "./console.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}

contract DSTestPlusF is DSTest, stdCheats {
    Vm public constant vm = Vm(HEVM_ADDRESS);

    using stdStorage for StdStorage;
    StdStorage stdstore;

    function writeTokenBalance(
        address who,
        address token,
        uint256 amt
    ) internal {
        stdstore.target(token).sig(IERC20(token).balanceOf.selector).with_key(who).checked_write(amt);
    }
}
