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

contract DeployTestUser is Script {
    function setUp() public {}

    function run(address tokenA, address tokenB, address user1, address user2) public {
        vm.startBroadcast();

        IERC20 _tokenA = IERC20(tokenA);
        IERC20 _tokenB = IERC20(tokenB);

        _tokenA.approve(msg.sender, 20 * 10 ** 18);
        _tokenB.approve(msg.sender, 6000 * 10 ** 18);

        _tokenA.transferFrom(msg.sender, user1, 10 * 10 ** 18);
        _tokenB.transferFrom(msg.sender, user1, 3000 * 10 ** 18);

        _tokenA.transferFrom(msg.sender, user2, 10 * 10 ** 18);
        _tokenB.transferFrom(msg.sender, user2, 3000 * 10 ** 18);

        vm.stopBroadcast();
    }
}
