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
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

struct Order {
    uint256 orderId;
    address account;
    uint256 sqrtPrice; // sqrt price used because it's cheaper to store (noteredundant as we have quote asset amount)
    uint256 amount; // base asset amount
    bool isBid; // bid is buying, ask is selling
    address baseAsset; // WETH in WETH/USDC
    address quoteAsset; // USDC in WETH/USDC
    uint256 quoteAmount; // quote asset amount (alternative representation of price, better for swapping)
    bool isValid;
    uint256 timestamp;
}

struct BestPrices {
    Order bid;
    Order ask;
}

// Limitation: For now, we store just best bid and best ask on-chain (for each token)
contract P2POrderBookAvsHook is IAvsLogic, BaseHook {
    using Address for address payable;

    address public immutable ATTESTATION_CENTER;

    mapping(address => mapping(address => uint256)) public escrowedFunds; // maker => token => amount

    // mapping(address => mapping(bool => Order)) public bestBidAndAsk; // token => isBid => Order
    mapping(address => mapping(address => BestPrices)) public bestBidAndAsk; // baseAsset => quoteAsset => BestPrices

    // event MakeOrder(uint256 indexed orderId, address indexed maker, uint256 sqrtPrice, uint256 amount);
    event UpdateBestOrder(
        uint256 indexed orderId,
        address maker,
        address indexed baseAsset,
        address indexed quoteAsset,
        uint256 sqrtPrice,
        uint256 amount
    );

    event PartialFillOrder(
        uint256 indexed takerOrderId,
        uint256 indexed makerOrderId
    );
    
    event CompleteFillOrder(
        uint256 indexed makerOrderId,
        uint256 indexed takerOrderId
    );

    event Swap(
        address account1, address indexed asset1, uint256 amount1,
        address account2, address indexed asset2, uint256 amount2
    );

    error InsufficientAllowance();

    // event CancelOrder(uint256 indexed orderId, address indexed maker);
    event WithdrawalProcessed(address indexed account, address indexed asset, uint256 amount);

    error TaskNotApproved();

    error OnlyAttestationCenter();

    error OrderTooLarge();

    error InvalidTaskDefinitionId();

    error UnsuccessfulTransfer();

    error DirectWithdrawalDisabled();

    error EscrowBalanceMismatch();

    constructor(address _attestationCenterAddress, IPoolManager _poolManager) BaseHook(_poolManager) {
        ATTESTATION_CENTER = _attestationCenterAddress;
    }

    // ============== ESCROW MANAGEMENT ==============

    function escrow(address asset, uint256 amount) external {
        // Check allowance
        uint256 allowance = IERC20(asset).allowance(msg.sender, address(this));
        if (allowance < amount) revert InsufficientAllowance();

        // Transfer into contract
        bool success = IERC20(asset).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        if (!success) revert UnsuccessfulTransfer();

        // Update escrow balance
        escrowedFunds[msg.sender][asset] += amount;
    }

    // function withdraw(address asset, uint256 amount) external {}
    function withdraw(address, uint256) external pure {
        // TODO: can only be done by user a week after depositing, perhaps subject to other restrictions to prevent sneaky withdrawals
        revert DirectWithdrawalDisabled();
    }

    function swapBalances(
        address account1,
        address asset1,
        uint256 amount1,
        address account2,
        address asset2,
        uint256 amount2
    ) private {
        mapping(address => uint256) storage accountEscrow1 = escrowedFunds[account1];
        mapping(address => uint256) storage accountEscrow2 = escrowedFunds[account2];

        // Checks
        if (accountEscrow1[asset1] < amount1 || accountEscrow2[asset2] < amount2)
            revert EscrowBalanceMismatch();

        // Asset 1: Account 1 transfers <amount 1> of <asset 1> to Account 2
        accountEscrow1[asset1] -= amount1;
        accountEscrow2[asset1] += amount1;

        // Asset 2: Account 2 transfers <amount 2> of <asset 2> to Account 1
        accountEscrow2[asset2] -= amount2;
        accountEscrow1[asset2] += amount2;

        emit Swap(
            account1, asset1, amount1,
            account2, asset2, amount2
        );
    }

    // ============== DATA PROCESSING HELPERS ==============

    function extractOrder(
        bytes calldata taskData,
        uint256 startIdx
    ) pure private returns (Order memory, uint256) {
        Order memory order = Order({
            orderId: uint256(bytes32(taskData[startIdx + 0 : startIdx + 32])),
            account: address(uint160(uint256(bytes32(taskData[startIdx + 32 : startIdx + 52])))),
            sqrtPrice: uint256(bytes32(taskData[startIdx + 52 : startIdx + 84])),
            amount: uint256(bytes32(taskData[startIdx + 84 : startIdx + 116])),
            isBid: uint8(taskData[startIdx + 116]) == 1,
            baseAsset: address(uint160(uint256(bytes32(taskData[startIdx + 117 : startIdx + 137])))),
            quoteAsset: address(uint160(uint256(bytes32(taskData[startIdx + 137 : startIdx + 157])))),
            quoteAmount: uint256(bytes32(taskData[startIdx + 137 : startIdx + 169])),
            isValid: uint8(taskData[startIdx + 169]) == 1,
            timestamp: uint256(bytes32(taskData[startIdx + 170 : startIdx + 202]))
        });

        return (order, startIdx + 202);
    }

    function extractWithdrawalData(
        bytes calldata taskData
    ) pure private returns (address, address, uint256) {
        address account = address(uint160(uint256(bytes32(taskData[0 : 20]))));
        address asset = address(uint160(uint256(bytes32(taskData[20 : 40]))));
        uint256 amount = uint256(bytes32(taskData[40 : 72]));
        return (account, asset, amount);
    }

    // ============== TASK FUNCTIONS ==============

    function taskUpdateBest(bytes calldata taskData) private {
        // Parse the bytes data into structured data
        (Order memory order,) = extractOrder(taskData, 0);

        // Get current best bid and ask
        BestPrices storage bestPrices = bestBidAndAsk[order.baseAsset][order.quoteAsset];

        if (order.isValid) {
            if (order.isBid) bestPrices.bid = order;
            else bestPrices.ask = order;
        } else {
            if (order.isBid) delete bestPrices.bid;
            else delete bestPrices.ask;
        }
        
        emit UpdateBestOrder(
            order.orderId,
            order.account,
            order.baseAsset,
            order.quoteAsset,
            order.sqrtPrice,
            order.amount
        );
    }

    function taskFillOrder(bytes calldata taskData) private {
        // Parse the bytes data into structured data
        (Order memory order, uint256 lastIdx) = extractOrder(taskData, 0);

        // Get current best bid and ask
        BestPrices storage bestPrices = bestBidAndAsk[order.baseAsset][order.quoteAsset];

        Order storage counterpartyOrder = (order.isBid) ? bestPrices.ask : bestPrices.bid;

        // Settle orders for full amount of incoming order and partial/full amount of best price order
        if (order.isBid) {
            // Incoming order is buyer, so they send quote asset and receive base asset
            swapBalances(
                order.account, order.quoteAsset, order.quoteAmount,
                counterpartyOrder.account, order.baseAsset, order.amount
            );
        } else {
            // Incoming order is seller, so they send base asset and receive quote asset
            swapBalances(
                order.account, order.baseAsset, order.amount,
                counterpartyOrder.account, order.quoteAsset, order.quoteAmount
            );
        }

        // Update best order
        if (counterpartyOrder.amount < order.amount) {
            // For now, only partially/fully filling best bid/ask
            revert OrderTooLarge();
        } else if (counterpartyOrder.amount > order.amount) {
            // Partial fill

            // This is the amount that will be remaining of the best order once partially filled
            uint256 amountRemaining = counterpartyOrder.amount - order.amount;
            uint256 quoteAmountRemaining = counterpartyOrder.quoteAmount - order.quoteAmount;

            // Update best price order by reducing amounts of existing best order
            counterpartyOrder.amount = amountRemaining;
            counterpartyOrder.quoteAmount = quoteAmountRemaining;

            emit PartialFillOrder(
                order.orderId,
                counterpartyOrder.orderId        
            );

            emit UpdateBestOrder(
                order.orderId,
                order.account,
                order.baseAsset,
                order.quoteAsset,
                order.sqrtPrice,
                amountRemaining
            );

        } else {
            // Complete fill (counterpartyOrder.amount == order.amount)

            // Update best price with next best order (passed in by AVS)
            (Order memory newBest,) = extractOrder(taskData, lastIdx);

            emit CompleteFillOrder(
                order.orderId,
                counterpartyOrder.orderId        
            );

            emit UpdateBestOrder(
                newBest.orderId,
                newBest.account,
                newBest.baseAsset,
                newBest.quoteAsset,
                newBest.sqrtPrice,
                newBest.amount
            );
        }
    }

    function taskProcessWithdrawal(bytes calldata taskData) private {
        (address account, address asset, uint256 amount) = extractWithdrawalData(taskData);
        mapping(address => uint256) storage accountEscrow = escrowedFunds[account];

        // Checks
        if (accountEscrow[asset] < amount) revert EscrowBalanceMismatch();

        // Modify escrow balance
        accountEscrow[asset] -= amount;
        
        // Transfer funds to user
        bool success = IERC20(asset).transfer(account, amount);

        if (!success) revert UnsuccessfulTransfer();

        emit WithdrawalProcessed(account, asset, amount);
    }

    /**
     * There are 3 kinds of tasks:
     * 0. UpdateBestPrice: Update best bid or best ask (in case of new best or cancellation of best)
     * 1. FillOrder: Settle, then
     *   if it is a partial fill (amount < best bid/ask) then reduce best bid/ask amount
     *   if it is a complete fill (amount == best bid/ask) then replace best bid/ask with new best
     * 2. ProcessWithdrawal: Send funds back to user
     * Note: for now we only have functionality that we can partially/fully accept the best bid/ask
     */
    function afterTaskSubmission(
        IAttestationCenter.TaskInfo calldata _taskInfo,
        bool _isApproved,
        bytes calldata, /* _tpSignature */
        uint256[2] calldata, /* _taSignature */
        uint256[] calldata /* _operatorIds */
    ) external {
        // TODO: Look into how to use this? For now just this.
        if (!_isApproved) revert TaskNotApproved();

        // Only AVS
        if (msg.sender != address(ATTESTATION_CENTER)) revert OnlyAttestationCenter();

        // UpdateBest - AVS knows this is the best price already, no checks needed
        if (_taskInfo.taskDefinitionId == 0) taskUpdateBest(_taskInfo.data);
        // FillOrder - for now, assuming we are fully/partially filling the best bid/ask
        else if (_taskInfo.taskDefinitionId == 1) taskFillOrder(_taskInfo.data);
        // ProcessWithdrawal - AVS triggers user withdrawal
        else if (_taskInfo.taskDefinitionId == 2) taskProcessWithdrawal(_taskInfo.data);
        // else revert InvalidTaskDefinitionId(); // no-op
    }

    // ============== UNUSED FUNCTIONS ==============

    function beforeTaskSubmission(
        IAttestationCenter.TaskInfo calldata _taskInfo,
        bool _isApproved,
        bytes calldata _tpSignature,
        uint256[2] calldata _taSignature,
        uint256[] calldata _attestersIds
    ) external {}

    // ============== HOOK FUNCTIONS FOR UNISWAP ==============

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
    // function _beforeSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata, bytes calldata) {}
    function _beforeSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, bytes calldata)
        internal
        virtual
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

}



// Code for unused Swap struct system (instead of Order struct):

// struct Order {
//     address user;
//     address asset;
//     address amount;
// }

// struct BestPrices {
//     address user1
// }

// struct Swap {
//     address user1;
//     address user2;
//     address asset1;
//     address asset2;
//     uint256 amount1;
//     uint256 amount2;
// }

// function settle(
//     IAttestationCenter.TaskInfo calldata _taskInfo,
//     bool _isApproved,
//     bytes calldata, /* _tpSignature */
//     uint256[2] calldata, /* _taSignature */
//     uint256[] calldata /* _operatorIds */
// ) external {
//     // Task function
//     if (msg.sender != address(ATTESTATION_CENTER)) revert OnlyAttestationCenter();

//     // Parse task info into Swap struct
//     Order memory order1 = Swap({
//         user1: address(uint160(uint256(bytes32(_taskInfo.data[0:20])))),
//         user2: address(uint160(uint256(bytes32(_taskInfo.data[20:40])))),
//         asset1: address(uint160(uint256(bytes32(_taskInfo.data[40:60])))),
//         asset2: address(uint160(uint256(bytes32(_taskInfo.data[60:80])))),
//         amount1: uint256(bytes32(_taskInfo.data[80:112])),
//         amount2: uint256(bytes32(_taskInfo.data[112:144]))
//     });
    
//     // Then: include best price update in this
// }
