// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.20;

/*______     __      __                              __      __ 
 /      \   /  |    /  |                            /  |    /  |
/$$$$$$  | _$$ |_   $$ |____    ______   _______   _$$ |_   $$/   _______ 
$$ |  $$ |/ $$   |  $$      \  /      \ /       \ / $$   |  /  | /       |
$$ |  $$ |$$$$$$/   $$$$$$$  |/$$$$$$  |$$$$$$$  |$$$$$$/   $$ |/$$$$$$$/ 
$$ |  $$ |  $$ | __ $$ |  $$ |$$    $$ |$$ |  $$ |  $$ | __ $$ |$$ |
$$ \__$$ |  $$ |/  |$$ |  $$ |$$$$$$$$/ $$ |  $$ |  $$ |/  |$$ |$$ \_____ 
$$    $$/   $$  $$/ $$ |  $$ |$$       |$$ |  $$ |  $$  $$/ $$ |$$       |
 $$$$$$/     $$$$/  $$/   $$/  $$$$$$$/ $$/   $$/    $$$$/  $$/  $$$$$$$/
*/
/**
 * @author Othentic Labs LTD.
 * @notice Terms of Service: https://www.othentic.xyz/terms-of-service
 */
import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {P2POrderBookAvsHook} from "../src/P2POrderBookAvsHook.sol";

contract DeployTestUser1 is Script {
    function setUp() public {}

    function run(address tokenA, address tokenB, address avsHook) public {
        vm.startBroadcast();

        P2POrderBookAvsHook hook = P2POrderBookAvsHook(avsHook);
        IERC20 _tokenA = IERC20(tokenA);
        IERC20 _tokenB = IERC20(tokenB);

        // Check balance before operations
        uint256 balance = _tokenA.balanceOf(msg.sender);
        console.log("Token A balance:", balance);
        console.log("Sender address:", msg.sender);
        console.log("Hook address:", avsHook);

        uint256 amount = 1*1e18;
        console.log("Amount to escrow:", amount);

        // Check allowance before approve
        uint256 allowanceBefore = _tokenA.allowance(msg.sender, avsHook);
        console.log("Allowance before approve:", allowanceBefore);

        // Approve the hook to spend tokenA
        _tokenA.approve(avsHook, amount);

        // Check allowance after approve
        uint256 allowanceAfter = _tokenA.allowance(msg.sender, avsHook);
        console.log("Allowance after approve:", allowanceAfter);

        // Then call escrow
        hook.escrow(tokenA, amount);

        vm.stopBroadcast();
    }
}
