// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {IAvsLogic} from "./interfaces/IAvsLogic.sol";
import {IAttestationCenter} from "./interfaces/IAttestationCenter.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

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
contract P2POrderBookAvsHook is IAvsLogic, BaseHook, ReentrancyGuard, Ownable {
    using PoolIdLibrary for PoolKey;
    using Address for address payable;

    address public immutable ATTESTATION_CENTER;

    mapping(address => mapping(address => uint256)) public escrowedFunds; // maker => token => amount

    mapping(address => mapping(address => BestPrices)) public bestBidAndAsk; // baseAsset => quoteAsset => BestPrices

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
    
    error InvalidPartialFill();
    
    error InvalidCompleteFill();

    error InvalidTaskDefinitionId(uint256 id);

    error UnsuccessfulTransfer();

    error DirectWithdrawalDisabled();

    error EscrowBalanceMismatch();

    error ReentrancyError();

    error NotAuthorized();

    constructor(address _attestationCenterAddress, IPoolManager _poolManager) BaseHook(_poolManager) Ownable(msg.sender) {
        ATTESTATION_CENTER = _attestationCenterAddress;
    }

    // ============== ADMIN FUNCTIONS ==============

    /**
     * Emergency function to recover tokens sent to the contract by mistake
     * Can only be called by the contract owner
     */
    function recoverTokens(address token, uint256 amount) external onlyOwner nonReentrant {
        require(token != address(0), "Invalid token");
        bool success = IERC20(token).transfer(owner(), amount);
        if (!success) revert UnsuccessfulTransfer();
    }

    // ============== ESCROW MANAGEMENT ==============

    function escrow(address asset, uint256 amount) external nonReentrant {
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

    function withdraw(address, uint256) external pure {
        // Can only be done by user a week after depositing, perhaps subject to other restrictions to prevent sneaky withdrawals
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

    function extractOrder(bytes calldata taskData, uint256 offset) pure private returns (Order memory) {
        (
            uint256 orderId,
            address account,
            uint256 sqrtPrice,
            uint256 amount,
            uint8 isBid,
            address baseAsset,
            address quoteAsset,
            uint256 quoteAmount,
            uint8 isValid,
            uint256 timestamp
        ) = abi.decode(
            taskData[offset:], (uint256, address, uint256, uint256, uint8, address, address, uint256, uint8, uint256)
        );

        Order memory order = Order(orderId, account, sqrtPrice, amount, isBid == 1, baseAsset, quoteAsset, quoteAmount, isValid == 1, timestamp);

        return order;
    }

    function extractWithdrawalData(
        bytes calldata taskData
    ) pure private returns (address, address, uint256) {
        address account = abi.decode(taskData[0:], (address));
        address asset = abi.decode(taskData[20:], (address));
        uint256 amount = abi.decode(taskData[40:], (uint256));

        // address account = address(uint160(uint256(bytes32(taskData[0 : 20]))));
        // address asset = address(uint160(uint256(bytes32(taskData[20 : 40]))));
        // uint256 amount = uint256(bytes32(taskData[40 : 72]));
        return (account, asset, amount);
    }

    // ============== TASK FUNCTIONS ==============

    function taskUpdateBest(bytes calldata taskData) private nonReentrant {
        // Parse the bytes data into structured data
        Order memory order = extractOrder(taskData, 0);

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

    function taskPartialFillOrder(bytes calldata taskData) private nonReentrant {
        // Parse the bytes data into structured data
        Order memory order = extractOrder(taskData, 0);

        // Get current best bid and ask
        BestPrices storage bestPrices = bestBidAndAsk[order.baseAsset][order.quoteAsset];

        Order storage counterpartyOrder = (order.isBid) ? bestPrices.ask : bestPrices.bid;

        if (counterpartyOrder.amount < order.amount) {
            // For now, only partially/fully filling best bid/ask
            revert OrderTooLarge();
        } else if (counterpartyOrder.amount == order.amount) {
            // This should be a Complete Fill Order
            revert InvalidPartialFill();
        }

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
    }

    function taskCompleteFillOrder(bytes calldata taskData) private nonReentrant {
        uint256 ORDER_SIZE = 320; // 10 fields * 32 bytes each (with padding)

        // Parse the bytes data into structured data
        Order memory order = extractOrder(taskData, 0);
        Order memory newBest = extractOrder(taskData, ORDER_SIZE);

        // Get current best bid and ask
        BestPrices storage bestPrices = bestBidAndAsk[order.baseAsset][order.quoteAsset];

        Order storage counterpartyOrder = (order.isBid) ? bestPrices.ask : bestPrices.bid;

        if (counterpartyOrder.amount < order.amount) {
            // For now, only partially/fully filling best bid/ask
            revert OrderTooLarge();
        } else if (counterpartyOrder.amount > order.amount) {
            // This should be a Partial Fill Order
            revert InvalidCompleteFill();
        }

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

        // Update best price with next best order (passed in by AVS)

        if (newBest.isValid) {
            if (newBest.isBid) bestPrices.bid = newBest;
            else bestPrices.ask = newBest;
        } else {
            // Flip sides
            if (order.isBid) delete bestPrices.ask;
            else delete bestPrices.bid;
        }

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


    function taskProcessWithdrawal(bytes calldata taskData) private nonReentrant {
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
     * [NEW] There are 5 kinds of tasks on-chain:
     * 1. No-op (): Order does not cross spread and is not best price.
     * 2. UpdateBestPrice (order): Order does not cross spread but is best price OR best price order cancelled.
     * 3. PartialFill (order): Order crosses spread and partially fills best price.
     * 4. CompleteFill (order, nextOrder): Order crosses spread and completely fills best price, also update best price.
     * 5. ProcessWithdrawal (account, amount): User requested withdrawal, send money back.
     * Note: for now we only have functionality that we can partially/fully accept the best bid/ask
     */
    function afterTaskSubmission(
        IAttestationCenter.TaskInfo calldata _taskInfo,
        bool _isApproved,
        bytes calldata, /* _tpSignature */
        uint256[2] calldata, /* _taSignature */
        uint256[] calldata /* _operatorIds */
    ) external {
        if (!_isApproved) revert TaskNotApproved();

        // Only AVS
        if (msg.sender != address(ATTESTATION_CENTER)) revert OnlyAttestationCenter();

        if (_taskInfo.taskDefinitionId == 1) {}
            // No-op
        else if (_taskInfo.taskDefinitionId == 2) taskUpdateBest(_taskInfo.data);
            // UpdateBest - AVS knows this is the best price already, no checks needed
        else if (_taskInfo.taskDefinitionId == 3) taskPartialFillOrder(_taskInfo.data);
            // PartialFillOrder - we are partially filling only the best bid/ask
        else if (_taskInfo.taskDefinitionId == 4) taskCompleteFillOrder(_taskInfo.data);
            // FillOrder - we are completely filling the best bid/ask
        else if (_taskInfo.taskDefinitionId == 5) taskProcessWithdrawal(_taskInfo.data);
            // ProcessWithdrawal - AVS triggers user withdrawal
        else revert InvalidTaskDefinitionId(_taskInfo.taskDefinitionId);
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

    function _beforeSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata swapParams, bytes calldata hookData)
        internal
        virtual
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {

        // 0 is base, 1 is quote
        BestPrices storage direction01 = bestBidAndAsk[Currency.unwrap(key.currency0)][Currency.unwrap(key.currency1)];
        
        // 1 is base, 0 is quote
        BestPrices storage direction10 = bestBidAndAsk[Currency.unwrap(key.currency1)][Currency.unwrap(key.currency0)];

        // See if it's a buy or sell:

        Order memory opposingOrder;

        // Figure out token amount spent
        uint256 token0SpendAmount = swapParams.amountSpecified < 0
            ? uint256(-swapParams.amountSpecified)
            : uint256(int256(-swapParams.amountSpecified));
        
        if (swapParams.zeroForOne) {
            // Wants to swap token0 for token1 (either sell direction01 or buy direction 10)
            // If selling direction01, must fill a bid
            // If buying direction10, must fill an ask
            if (direction01.bid.isValid) {
                // opposing order found, check price is better
                if (direction01.bid.sqrtPrice < swapParams.sqrtPriceLimitX96 && direction01.bid.amount <= token0SpendAmount) {
                    // swap with contract
                    opposingOrder = direction01.bid;
                }
            } else if (direction10.ask.isValid) {
                if (direction10.ask.sqrtPrice > swapParams.sqrtPriceLimitX96 && direction10.ask.amount <= token0SpendAmount) {
                    // swap with contract
                    opposingOrder = direction10.ask;
                }
            }
        } else {
            // Wants to swap token1 for token0 (either buy direction01 or sell direction 10)
            // If buying direction01, must fill an ask
            // If selling direction10, must fill a bid
            if (direction01.ask.isValid) {
                // opposing order found, check price is better
                if (direction01.ask.sqrtPrice > swapParams.sqrtPriceLimitX96 && direction01.ask.amount <= token0SpendAmount) {
                    // swap with contract
                    opposingOrder = direction01.ask;
                }
            } else if (direction10.bid.isValid) {
                if (direction10.bid.sqrtPrice < swapParams.sqrtPriceLimitX96 && direction10.bid.amount <= token0SpendAmount) {
                    // swap with contract
                    opposingOrder = direction10.bid;
                }
            }
        }

        if (opposingOrder.isValid) {
            // We are swapping with the contract
            address user = abi.decode(hookData, (address));

        } else {
            // Proceed with AMM swap as normal (WIP)
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

}


// function extractOrder(bytes calldata taskData, uint256 offset) pure private returns (Order memory) {
//     return Order({
//         orderId: abi.decode(taskData[offset:], (uint256)),
//         account: abi.decode(taskData[offset + 32:], (address)),
//         sqrtPrice: abi.decode(taskData[offset + 52:], (uint256)),
//         amount: abi.decode(taskData[offset + 84:], (uint256)),
//         isBid: abi.decode(taskData[offset + 116:], (uint8)) == 1,
//         baseAsset: abi.decode(taskData[offset + 117:], (address)),
//         quoteAsset: abi.decode(taskData[offset + 137:], (address)),
//         quoteAmount: abi.decode(taskData[offset + 157:], (uint256)),
//         isValid: abi.decode(taskData[offset + 189:], (uint8)) == 1,
//         timestamp: abi.decode(taskData[offset + 190:], (uint256))
//     });
// }

// function extractOrders(bytes calldata taskData) pure private returns (Order memory, Order memory) {

//     Order memory order1 = extractOrder(taskData, 0);
//     Order memory order2 = extractOrder(taskData, 222);

//     return (order1, order2);
// }

// (Order memory order, Order memory newBest) = extractOrders(taskData);

// struct OrderData {
//     uint256 orderId;
//     address account;
//     uint256 sqrtPrice;
//     uint256 amount;
//     uint8 isBid;
//     address baseAsset;
//     address quoteAsset;
//     uint256 quoteAmount;
//     uint8 isValid;
//     uint256 timestamp;
// }


// OrderData memory 
// OrderData memory orderData2;

// {
//     (
//         // First order
//         orderData1.orderId, orderData1.account, orderData1.sqrtPrice, orderData1.amount, orderData1.isBid, 
//         orderData1.baseAsset, orderData1.quoteAsset, orderData1.quoteAmount, orderData1.isValid, orderData1.timestamp,
//         // Second order
//         orderData2.orderId, orderData2.account, orderData2.sqrtPrice, orderData2.amount, orderData2.isBid, 
//         orderData2.baseAsset, orderData2.quoteAsset, orderData2.quoteAmount, orderData2.isValid, orderData2.timestamp
//     ) = abi.decode(
//         taskData,
//         (
//             uint256, address, uint256, uint256, uint8, address, address, uint256, uint8, uint256,
//             uint256, address, uint256, uint256, uint8, address, address, uint256, uint8, uint256
//         )
//     );
// }

// Order memory order1 = Order(
//     orderData1.orderId, orderData1.account, orderData1.sqrtPrice, orderData1.amount, 
//     orderData1.isBid == 1, orderData1.baseAsset, orderData1.quoteAsset, 
//     orderData1.quoteAmount, orderData1.isValid == 1, orderData1.timestamp
// );

// Order memory order2 = Order(
//     orderData2.orderId, orderData2.account, orderData2.sqrtPrice, orderData2.amount, 
//     orderData2.isBid == 1, orderData2.baseAsset, orderData2.quoteAsset, 
//     orderData2.quoteAmount, orderData2.isValid == 1, orderData2.timestamp
// );