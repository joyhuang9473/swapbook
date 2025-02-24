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
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2POrderBookAvsHook is IAvsLogic, BaseHook {
    address public immutable ATTESTATION_CENTER;

    struct Order {
        uint256 orderId;
        address account;
        uint256 sqrtPrice; // sqrt price used because it's cheaper to store
        uint256 amount;
        address baseAsset; // WETH in WETH/USDC
        address quoteAsset; // USDC in WETH/USDC
        bool isBid; // bid is buying, ask is selling
    }

    mapping(address => mapping(address => uint256)) public escrowedFunds; // maker => token => amount
    mapping(address => mapping(bool => Order)) public bestBidAndAsk; // token => isBid => Order

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

        // Parse the bytes data into structured data
        Order memory order = Order({
            orderId: uint256(bytes32(_taskInfo.data[0:32])),
            account: address(uint160(uint256(bytes32(_taskInfo.data[32:52])))),
            sqrtPrice: uint256(bytes32(_taskInfo.data[52:84])),
            amount: uint256(bytes32(_taskInfo.data[84:116])),
            isBid: uint8(_taskInfo.data[116]) == 1,
            token0: address(uint160(uint256(bytes32(_taskInfo.data[117:137])))),
            token1: address(uint160(uint256(bytes32(_taskInfo.data[137:157]))))
        });

        if (_taskInfo.taskDefinitionId == 0) { // KeepAlive
            return;
        } else if (_taskInfo.taskDefinitionId == 1) { // MakeOrder
            if (order.isBid && order.sqrtPrice > bestBidAndAsk[order.token0][true].sqrtPrice) {
                // if this order is the best bid, update the best bid
                bestBidAndAsk[order.token0][true] = order;
            } else if (!order.isBid && order.sqrtPrice < bestBidAndAsk[order.token0][false].sqrtPrice) {
                // if this order is the best ask, update the best ask
                bestBidAndAsk[order.token0][false] = order;
            }
            // escrow the funds
            if (order.isBid) {
                this.escrowFunds(order.account, order.token1, order.amount);
            } else {
                this.escrowFunds(order.account, order.token0, order.amount);
            }

            emit MakeOrder(
                order.orderId,
                order.account,
                order.sqrtPrice,
                order.amount
            );
        } else if (_taskInfo.taskDefinitionId == 2) { // FillOrder
            // TODO: fill the order
        } else if (_taskInfo.taskDefinitionId == 3) { // CancelOrder
            // release the funds
            if (order.isBid) {
                this.releaseFunds(order.account, order.token1, order.amount);
            } else {
                this.releaseFunds(order.account, order.token0, order.amount);
            }

            emit CancelOrder(
                order.orderId,
                order.account
            );
        } else {
            revert("Invalid task definition id");
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
