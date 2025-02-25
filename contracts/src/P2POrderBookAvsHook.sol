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

    mapping(address=>BestPrices) public bestBids;
    mapping(address=>BestPrices) public bestAsks;

    constructor(address _attestationCenterAddress, IPoolManager _poolManager) BaseHook(_poolManager) {
        ATTESTATION_CENTER = _attestationCenterAddress;
    }











    // Hook Logic:
    // For now, we store 3 best bids and 3 best asks on-chain (for each token)
    // Need function to replace one of these best prices (task function)
    // Need function to settle, i.e. swap (usr1, amt1, tok1) with (usr2, amt2, tok2) and replace one of the best prices



    // ============== Hook Logic OLD FUNCTIONS ==============

    struct Order {
        uint256 orderId;
        address account;
        uint256 sqrtPrice; // sqrt price used because it's cheaper to store (noteredundant as we have quote asset amount)
        uint256 amount; // base asset amount
        bool isBid; // bid is buying, ask is selling
        address baseAsset; // WETH in WETH/USDC
        address quoteAsset; // USDC in WETH/USDC
        uint256 quoteAmount; // quote asset amount (alternative representation of price, better for swapping)
    }

    struct BestPrices {
        Order bid;
        Order ask;
    }

    mapping(address => mapping(address => uint256)) public escrowedFunds; // maker => token => amount
    // mapping(address => mapping(bool => Order)) public bestBidAndAsk; // token => isBid => Order
    mapping(address => mapping(address => BestPrices)) public bestBidAndAsk; // baseAsset => quoteAsset => BestPrices

    // event MakeOrder(uint256 indexed orderId, address indexed maker, uint256 sqrtPrice, uint256 amount);
    event UpdateBestOrder(uint256 indexed orderId, address indexed maker, uint256 sqrtPrice, uint256 amount);

    event FillOrder(uint256 indexed orderId, address indexed taker, uint256 sqrtPrice, uint256 amount);

    event CancelOrder(uint256 indexed orderId, address indexed maker);

    error OnlyAttestationCenter();

    error OrderTooLarge();

    error InvalidTaskDefinitionId();

    error UnsuccessfulTransfer();

    error DirectWithdrawalDisabled();

    error EscrowBalanceMismatch();

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

    // ============== AVS OLD FUNCTIONS ==============

    function escrow(address asset, uint256 amount) external {
        // Transfer into contract
        bool success = IERC20(asset).transferFrom(
            address(this),
            msg.sender,
            amount
        );

        if (!success) revert UnsuccessfulTransfer();

        // Update escrow balance
        escrowedFunds[msg.sender][asset] += amount;
    }

    function withdraw(address asset, uint256 amount) external {
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
        // Checks
        uint256 escrow1 = escrowedFunds[account1][asset1];
        uint256 escrow2 = escrowedFunds[account2][asset2];

        if (escrowedFunds[account1][asset1] < amount1 || escrowedFunds[account2][asset2] < amount2)
            revert EscrowBalanceMismatch();

        // Account 1 transfers <amount 1> of <asset 1> to Account 2
        // TODO

        // Account 2 transfers <amount 2> of <asset 2> to Account 1

    }





    function extractOrder(
        IAttestationCenter.TaskInfo calldata _taskInfo,
        uint256 startIdx
    ) returns (Order memory, uint256) {
        Order memory order = Order({
            orderId: uint256(bytes32(_taskInfo.data[startIdx + 0 : startIdx + 32])),
            account: address(uint160(uint256(bytes32(_taskInfo.data[startIdx + 32 : startIdx + 52])))),
            sqrtPrice: uint256(bytes32(_taskInfo.data[startIdx + 52 : startIdx + 84])),
            amount: uint256(bytes32(_taskInfo.data[startIdx + 84 : startIdx + 116])),
            isBid: uint8(_taskInfo.data[startIdx + 116]) == 1,
            baseAsset: address(uint160(uint256(bytes32(_taskInfo.data[startIdx + 117 : startIdx + 137])))),
            quoteAsset: address(uint160(uint256(bytes32(_taskInfo.data[startIdx + 137 : startIdx + 157])))),
            quoteAmount: uint256(bytes32(_taskInfo.data[startIdx + 137 : startIdx + 169]))
        });

        return (order, startIdx + 157);
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
        if (msg.sender != address(ATTESTATION_CENTER)) revert OnlyAttestationCenter();

        // Parse the bytes data into structured data
        (Order memory order, uint256 lastIndex) = extractOrder(_taskInfo, 0);

        // Get current best bid and ask
        BestPrices storage bestPrices = bestBidAndAsk[order.baseAsset][order.quoteAsset];

        if (_taskInfo.taskDefinitionId == 0) {
            // UpdateBest - AVS knows this is the best price already, no checks needed

            if (order.isBid) bestPrices.bid = order;
            else bestPrices.ask = order;
            
            emit UpdateBestOrder(
                order.orderId,
                order.account,
                order.sqrtPrice,
                order.amount
            );
        } else if (_taskInfo.taskDefinitionId == 1) {
            // FillOrder - for now, assuming we are fully/partially filling the best bid/ask

            Order storage counterpartyOrder = (order.isBid) ? bestPrices.ask : bestPrices.bid;

            if (counterpartyOrder.amount < order.amount) {
                // For now, only partially/fully filling best bid/ask
                revert OrderTooLarge();
            } else if (counterpartyOrder.amount > order.amount) {
                // Partial fill

                // This is the amount that will be remaining of the best order once partially filled
                uint256 amountRemaining = counterpartyOrder.amount - order.amount;
                uint256 quoteAmountRemaining = counterPartOrder.quoteAmount - order.quoteAmount;

                // Update best price order
                counterpartyOrder.amount = amountRemaining;
                counterpartyOrder.quoteAmount = quoteAmountRemaining;

                emit UpdateBestOrder(
                    order.orderId,
                    order.account,
                    order.sqrtPrice,
                    amountRemaining
                );

                // Now, settle orders for full amount of incoming order and partial amount of best price order
                if (order.isBid) {
                    // Incoming order is buyer, so they send quote asset and receive base asset
                    swapBalances(
                        order.account, order.quoteAsset, order.quoteAmount,
                        counterpartyOrder.account, counterpartyOrder.baseAsset, counterpartyOrder.amount
                    );
                } else {
                    // Incoming order is seller, so they send base asset and receive quote asset
                    swapBalances(
                        order.account, order.baseAsset, order.amount,
                        counterpartyOrder.account, counterpartyOrder.quoteAsset, counterpartyOrder.quoteAmount
                    );
                }
            } else { // counterpartyOrder.amount == order.amount
                // Complete fill

                // TODO
            }

            // Settle - swap maker and takers funds

            // Update best price

            if () {
                // Case: Partial fill (reduce amount of best price)
            } else if () {
                // Case: Complete fill (replace best price with next order in book)
                Order memory newBest = extractOrder(_taskInfo, lastIdx);
                // ...
            } else {
                // Invalid (only accepting orders that fill best for now)
            }


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
            revert InvalidTaskDefinitionId();
        }

    }

    // ============== Hook Functions for Uniswap ==============

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
