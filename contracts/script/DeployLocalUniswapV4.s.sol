// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20;

import {Script} from "forge-std/Script.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolDonateTest} from "v4-core/src/test/PoolDonateTest.sol";
import {PoolTakeTest} from "v4-core/src/test/PoolTakeTest.sol";
import {PoolClaimsTest} from "v4-core/src/test/PoolClaimsTest.sol";

import "forge-std/console.sol";

contract DeployLocalUniswapV4 is Script {
    function run(address owner) public {
        vm.startBroadcast();

        PoolManager manager = new PoolManager(owner);
        console.log("Deployed PoolManager at", address(manager));

        vm.stopBroadcast();
    }
}
