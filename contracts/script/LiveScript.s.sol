// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "./DeployMockERC.s.sol";
import "./DeployLocalUniswapV4.s.sol";
import "./DeployP2POrderBookAvsHook.s.sol";

contract LiveScript is Script {
    
    address constant PK1 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    function run() external {
        // Deploy PoolManager
        DeployLocalUniswapV4 deployLocalUniswapV4 = new DeployLocalUniswapV4();
        address poolManager = deployLocalUniswapV4.run(PK1);

        // Deploy Hook
        DeployP2POrderBookAvsHook deployP2POrderBookAvsHook = new DeployP2POrderBookAvsHook();
        address hook = deployP2POrderBookAvsHook.run(PK1, poolManager);

        // Deploy WETH, USDC
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 usdc = new MockERC20("USDC", "USDC", 18);

        // Mint WETH, USDC
        weth.mint(PK1, 1000 ether);
        usdc.mint(PK1, 10000 ether);

        console.log("WETH Balance:", weth.balanceOf(PK1));
        console.log("USDC Balance:", usdc.balanceOf(PK1));
    }
}