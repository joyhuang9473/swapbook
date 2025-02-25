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
import {IAttestationCenter} from "../src/interfaces/IAttestationCenter.sol";
import {P2POrderBookAvsHook} from "../src/P2POrderBookAvsHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {console} from "forge-std/console.sol";

// How to:
// Either `source ../../.env` or replace variables in command.
// forge script DynamicFeesAvsHookDeploy --rpc-url $L2_RPC --private-key $PRIVATE_KEY
// --broadcast -vvvv --verify --etherscan-api-key $L2_ETHERSCAN_API_KEY --chain
// $L2_CHAIN --verifier-url $L2_VERIFIER_URL --sig="run(address,address)" $ATTESTATION_CENTER_ADDRESS $POOL_MANAGER_ADDRESS
contract DeployP2POrderBookAvsHook is Script {
    function setUp() public {}

    // Replacing attestation service with address1 for now
    address constant ADDRESS1 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    function run(address attestationCenter, address poolManager) public returns (address) {
        // https://book.getfoundry.sh/guides/deterministic-deployments-using-create2?highlight=CREATE2_DEPLOY#deterministic-deployments-using-create2
        address CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG);
        // bytes memory constructorArgs = abi.encode(attestationCenter, IPoolManager(poolManager));
        bytes memory constructorArgs = abi.encode(ADDRESS1, IPoolManager(poolManager));

        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(P2POrderBookAvsHook).creationCode, constructorArgs);

        console.log("Mined hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        vm.startBroadcast();
        // P2POrderBookAvsHook avsHook = new P2POrderBookAvsHook{salt: salt}(attestationCenter, IPoolManager(poolManager));
        P2POrderBookAvsHook avsHook = new P2POrderBookAvsHook{salt: salt}(ADDRESS1, IPoolManager(poolManager));

        require(address(avsHook) == hookAddress, "Hook address mismatch");

        // IAttestationCenter(attestationCenter).setAvsLogic(address(avsHook));
        vm.stopBroadcast();
        console.log("Attestation Center:", attestationCenter);
        console.log("AVS Hook deployed at:", address(this));

        return hookAddress;
    }
}


// forge script script/DeployLocalUniswapV4.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --sig "run(address)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --gas-limit 15000000

// cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 "owner()" --rpc-url http://127.0.0.1:8545

// forge script script/DeployP2POrderBookAvsHook.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --sig "run(address,address)" "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" "0x5FbDB2315678afecb367f032d93F642f64180aa3"
