// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20;

import {Script} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import "forge-std/console.sol";

contract DeployMockERC is Script {
    function run() public {
        vm.startBroadcast();

        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 usdc = new MockERC20("USDC", "USDC", 18);

        console.log("Deployed WETH at", address(weth));
        console.log("Deployed USDC at", address(usdc));

        vm.stopBroadcast();
    }
}

// WETH: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
// USDC: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

// cast send 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "mint(address,uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 10000e18 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
// cast send 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 "mint(address,uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 10000e18 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
