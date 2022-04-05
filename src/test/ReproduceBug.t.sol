// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "forge-std/stdlib.sol";
import "forge-std/Vm.sol";
import "ds-test/test.sol";

interface IMethods {
    function rev() external;
}

contract Methods {
    event Rev(string revertMsg);
    
    function rev() public {
        uint256 num = 1;
        require(num == 0, "reverteddd");
    }
}

contract Delegator {
    function rev2(address addy) public {
        IMethods(addy).rev();
    }    
}

contract User {
    uint256 private num1 = 1;
}

contract BugTest is DSTest {
    Vm public constant vm = Vm(HEVM_ADDRESS);
    
    Methods public hey;
    User public user;
    
    function setUp() public {
        hey = new Methods();
        user = new User();
    }
    
    function testBug() public {
        
        vm.expectRevert(bytes("heyo0o"));
        address(user).delegatecall(abi.encodeWithSignature("rev()"));
    }
}