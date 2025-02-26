// NOTE: This is based on V4PreDeployed.s.sol
// You can make changes to base on V4Deployer.s.sol to deploy everything fresh as well

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20;

import {Script} from "forge-std/Script.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolDonateTest} from "v4-core/src/test/PoolDonateTest.sol";
import {PoolTakeTest} from "v4-core/src/test/PoolTakeTest.sol";
import {PoolClaimsTest} from "v4-core/src/test/PoolClaimsTest.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {console} from "forge-std/console.sol";
import {DynamicFeesAvsHook} from "../src/DynamicFeesAvsHook.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";



contract DeployToken is Script {

    Currency token0;
    Currency token1;
    PoolKey key;

    function setUp() public {}

    function run(address poolManager, address avsHook) public {
        PoolManager manager = PoolManager(poolManager);
        DynamicFeesAvsHook hook = DynamicFeesAvsHook(avsHook);

        vm.startBroadcast();

        MockERC20 tokenA = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 tokenB = new MockERC20("USDC", "USDC", 18);

        console.log("tokenA", address(tokenA));
        console.log("tokenB", address(tokenB));

        if (address(tokenA) > address(tokenB)) {
            (token0, token1) = (
                Currency.wrap(address(tokenB)),
                Currency.wrap(address(tokenA))
            );
        } else {
            (token0, token1) = (
                Currency.wrap(address(tokenA)),
                Currency.wrap(address(tokenB))
            );
        }

        tokenA.mint(msg.sender, 1000 * 10 ** 18);
        tokenB.mint(msg.sender, 10000 * 10 ** 18);

        key = PoolKey({
            currency0: token0,
            currency1: token1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG, // signal that the pool has a dynamic fee
            tickSpacing: 120,
            hooks: hook
        });

        manager.initialize(key, 79228162514264337593543950336); // the initial price ratio between token0 and token1 is 1:1.

        vm.stopBroadcast();
    }
}
