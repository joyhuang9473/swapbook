// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {IAvsLogic} from "./interfaces/IAvsLogic.sol";
import {IAttestationCenter} from "./interfaces/IAttestationCenter.sol";
import {console} from "forge-std/console.sol";

contract P2POrderBookAvsHook is IAvsLogic, BaseHook {
    address public immutable ATTESTATION_CENTER;

    struct Order {
        address account;
        uint256 sqrtPrice;
        uint256 amount;
    }

    Order public bestBid;
    Order public bestAsk;

    mapping(address => mapping(address => uint256)) public escrowedFunds; // maker => token => amount

    event MakeOrder(uint256 indexed orderId, address indexed maker, uint256 sqrtPrice, uint256 amount);

    event FillOrder(uint256 indexed orderId, address indexed taker, uint256 sqrtPrice, uint256 amount);

    event CancelOrder(uint256 indexed orderId, address indexed maker);

    error OnlyAttestationCenter();

    function escrowFunds(address maker, address token, uint256 amount) external {
        uint256 allowed = IERC20(token).allowance(maker, address(this));
        require(allowed >= amount, "Insufficient allowance");
        bool success = IERC20(token).transferFrom(maker, address(this), amount);
        require(success, "Transfer failed");
        // Record the escrowed funds
        escrowedFunds[maker][token] += amount;
    }

    function releaseFunds(address maker, address token, uint256 amount) external {
        // Add check for sufficient escrowed funds
        require(escrowedFunds[maker][token] >= amount, "Insufficient escrowed funds");
        bool success = IERC20(token).transfer(maker, amount);
        require(success, "Transfer failed");
        // Update the escrowed funds balance
        escrowedFunds[maker][token] -= amount;
    }

    constructor(address _attestationCenterAddress, IPoolManager _poolManager) BaseHook(_poolManager) {
        ATTESTATION_CENTER = _attestationCenterAddress;
    }

    // TODO
    function afterTaskSubmission(
        IAttestationCenter.TaskInfo calldata _taskInfo,
        bool _isApproved,
        bytes calldata, /* _tpSignature */
        uint256[2] calldata, /* _taSignature */
        uint256[] calldata /* _operatorIds */
    ) external {
        if (msg.sender != address(ATTESTATION_CENTER)) revert OnlyAttestationCenter();

        if (_taskInfo.taskDefinitionId == 1) { // MakeOrder
            // TODO: if this order is the best bid, update the best bid
            // TODO: if this order is the best ask, update the best ask
            // TODO: escrow the funds
        } else if (_taskInfo.taskDefinitionId == 2) { // FillOrder
            // TODO: fill the order
        } else if (_taskInfo.taskDefinitionId == 3) { // CancelOrder
            // TODO: release the funds
        }
        
    }

    function beforeTaskSubmission(
        IAttestationCenter.TaskInfo calldata _taskInfo,
        bool _isApproved,
        bytes calldata _tpSignature,
        uint256[2] calldata _taSignature,
        uint256[] calldata _attestersIds
    ) external {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // TODO: or maybe _afterSwap
    function _beforeSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata, bytes calldata)
        internal
        virtual
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

}
