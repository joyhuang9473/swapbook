"use strict";
const taskController = require("./task.controller.js");
const { Router } = require("express");
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");
const { ethers, AbiCoder } = require("ethers");
const P2POrderBookABI = require("./abi/P2POrderBookABI");
const dalService = require("./dal.service.js");

const router = Router();

// Order processing queue and lock management
const orderQueue = [];
let isOrderBookLocked = false;
let currentProcessingOrderId = null;

// Setup contract event listeners for order settlement events
function setupContractEventListeners() {
    const avsHookAddress = process.env.AVS_HOOK_ADDRESS;
    if (!avsHookAddress) {
        console.error("AVS_HOOK_ADDRESS environment variable is not set");
        return;
    }

    // Initialize ethers provider for contract events
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    const avsHookContract = new ethers.Contract(avsHookAddress, P2POrderBookABI, provider);

    // Listen for UpdateBestOrder event (Task 2)
    avsHookContract.on("UpdateBestOrder", (orderId, maker, baseAsset, quoteAsset, sqrtPrice, amount) => {
        console.log(`UpdateBestOrder event received for order ID: ${orderId}`);
        
        // If there's no current processing order, this is unexpected
        if (!currentProcessingOrderId) {
            console.error(`Received UpdateBestOrder event for order ID ${orderId} but no order is currently being processed`);
            return;
        }
        
        // If the event is for an order different from what we're currently processing, this is an error
        if (orderId.toString() !== currentProcessingOrderId) {
            console.error(`Received UpdateBestOrder event for unexpected order ID: ${orderId}, expected: ${currentProcessingOrderId}`);
            // Could add some recovery logic here if needed
            return;
        }
        
        unlockOrderBookAndProcessNextOrder();
    });

    // Listen for PartialFillOrder event (Task 3)
    avsHookContract.on("PartialFillOrder", (takerOrderId, makerOrderId) => {
        console.log(`PartialFillOrder event received for taker order ID: ${takerOrderId}`);
        
        // If there's no current processing order, this is unexpected
        if (!currentProcessingOrderId) {
            console.error(`Received PartialFillOrder event for taker order ID ${takerOrderId} but no order is currently being processed`);
            return;
        }
        
        // If the event is for an order different from what we're currently processing, this is an error
        if (takerOrderId.toString() !== currentProcessingOrderId) {
            console.error(`Received PartialFillOrder event for unexpected order ID: ${takerOrderId}, expected: ${currentProcessingOrderId}`);
            // Could add some recovery logic here if needed
            return;
        }
        
        unlockOrderBookAndProcessNextOrder();
    });

    // Listen for CompleteFillOrder event (Task 4)
    avsHookContract.on("CompleteFillOrder", (makerOrderId, takerOrderId) => {
        console.log(`CompleteFillOrder event received for taker order ID: ${takerOrderId}`);
        
        // If there's no current processing order, this is unexpected
        if (!currentProcessingOrderId) {
            console.error(`Received CompleteFillOrder event for taker order ID ${takerOrderId} but no order is currently being processed`);
            return;
        }
        
        // If the event is for an order different from what we're currently processing, this is an error
        if (takerOrderId.toString() !== currentProcessingOrderId) {
            console.error(`Received CompleteFillOrder event for unexpected order ID: ${takerOrderId}, expected: ${currentProcessingOrderId}`);
            // Could add some recovery logic here if needed
            return;
        }
        
        unlockOrderBookAndProcessNextOrder();
    });
}

// Initialize event listeners
setupContractEventListeners();

// Function to unlock order book and process the next order in the queue
async function unlockOrderBookAndProcessNextOrder() {
    console.log("Unlocking order book and processing next order...");
    currentProcessingOrderId = null;
    isOrderBookLocked = false;

    if (orderQueue.length > 0) {
        const nextOrder = orderQueue.shift();
        console.log(`Processing next order from queue. Queue length: ${orderQueue.length}`);
        
        try {
            await processOrder(nextOrder.orderData, nextOrder.res);
        } catch (error) {
            console.error("Error processing queued order:", error);
            nextOrder.res.status(500).send(new CustomError("Error processing queued order", { error: error.message }));
            
            // Make sure we're unlocked before processing the next order
            isOrderBookLocked = false;
            currentProcessingOrderId = null;
            
            // Continue with next order
            setTimeout(unlockOrderBookAndProcessNextOrder, 0);
        }
    } else {
        console.log("Order queue is empty");
    }
}

// Main function to process an order
async function processOrder(orderData, res) {
    try {
        isOrderBookLocked = true;
        
        const { account, price, quantity, side, baseAsset, quoteAsset, signature } = orderData;

        // Step 1: Verify that the signature comes from the account address
        // Recreate the message that was signed on the frontend
        const orderDataObj = {
            price: price,
            quantity: quantity,
            side: side,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset
        };
        
        // Convert the order data to the same format used for signing in the frontend
        const orderMessage = JSON.stringify(orderDataObj);
        
        // Get message hash - must match the exact method used in frontend with MetaMask
        // This assumes the frontend used personal_sign which prefixes with Ethereum message prefix
        const messageHash = ethers.hashMessage(orderMessage);
        
        // Recover the address from the signature
        let recoveredAddress;
        try {
            recoveredAddress = ethers.recoverAddress(messageHash, signature);
        } catch (error) {
            throw new CustomError("Invalid signature format", { error: error.message });
        }
        
        // Verify that the recovered address matches the account in the request
        if (recoveredAddress.toLowerCase() !== account.toLowerCase()) {
            throw new CustomError("Signature verification failed: signer does not match account", {
                providedAccount: account,
                recoveredSigner: recoveredAddress
            });
        }
        
        // Step 2: Check that the user has escrowed enough funds on the contract
        // Get contract address from environment variable
        const avsHookAddress = process.env.AVS_HOOK_ADDRESS;
        if (!avsHookAddress) {
            throw new CustomError("AVS_HOOK_ADDRESS environment variable is not set", {});
        }

        // Create contract instance to check escrowed funds using full ABI
        const avsHookContract = new ethers.Contract(avsHookAddress, P2POrderBookABI, ethers.provider);

        // Get token addresses from the TOKENS object
        const baseTokenAddress = TOKENS[baseAsset]?.address;
        const quoteTokenAddress = TOKENS[quoteAsset]?.address;
        
        if (!baseTokenAddress || !quoteTokenAddress) {
            throw new CustomError("Invalid token symbols", { baseAsset, quoteAsset });
        }

        // Calculate required amounts based on order side
        let requiredToken, requiredAmount;
        
        if (side === 'bid') {
            // For bid orders (buying), check quote asset (e.g., USDC in WETH/USDC)
            requiredToken = quoteTokenAddress;
            
            // Calculate quote amount if not directly available
            // bid orders need price * quantity of quote asset
            requiredAmount = ethers.parseUnits((price * quantity).toString(), TOKENS[quoteAsset].decimals);
        } else if (side === 'ask') {
            // For ask orders (selling), check base asset (e.g., WETH in WETH/USDC)
            requiredToken = baseTokenAddress;
            
            // ask orders need the base asset quantity
            requiredAmount = ethers.parseUnits(quantity.toString(), TOKENS[baseAsset].decimals);
        } else {
            throw new CustomError("Invalid order side", { side });
        }

        // Check if user has enough escrowed funds
        const escrowedAmount = await avsHookContract.escrowedFunds(account, requiredToken);
        
        if (escrowedAmount < requiredAmount) {
            throw new CustomError("Insufficient escrowed funds", {
                required: ethers.formatUnits(requiredAmount, side === 'bid' ? TOKENS[quoteAsset].decimals : TOKENS[baseAsset].decimals),
                available: ethers.formatUnits(escrowedAmount, side === 'bid' ? TOKENS[quoteAsset].decimals : TOKENS[baseAsset].decimals),
                asset: side === 'bid' ? quoteAsset : baseAsset
            });
        }

        // Step 3: Order book
        const timestamp = Date.now();

        const formData = new FormData();
        formData.append('payload', JSON.stringify({
            account: account,
            price: Number(price),
            quantity: Number(quantity),
            side: side,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            timestamp: timestamp
        }));

        // Send order to order book service
        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/register_order`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();

        // Check if the response is valid
        if (!response.ok) {
            throw new CustomError(data.error || data.message || `Failed to create order: HTTP status ${response.status}`, data);
        }

        // Check we haven't failed to enter order into order book
        if (data.status_code === 0) {
            throw new CustomError(`Failed to create order: ${data.message}`, data);
        }

        // Set the current processing order ID
        currentProcessingOrderId = data.order.orderId.toString();
        
        // For Task 1 (no-op), no need to wait for an event, unlock immediately
        if (data.taskId === 1) {
            console.log("Task 1 (no-op) doesn't require waiting for an event");
            
            // Still send the order data to the contract (to maintain consistent behavior)
            const result = await dalService.sendTaskToContract(
                `Task_${data.taskId}-Order_${data.order.orderId}-Timestamp_${timestamp}-Signature_${signature}`,
                "", // No messageData for Task 1
                data.taskId
            );
            
            if (!result) {
                throw new CustomError("Error in forwarding task from Performer", {});
            }
            
            // Return successful response immediately
            res.status(200).send(new CustomResponse(data));
            
            // Unlock immediately since there's no on-chain event to wait for
            setTimeout(unlockOrderBookAndProcessNextOrder, 0);
            return;
        }

        // For Tasks 2-4, we need to prepare the messageData and send it to the contract
        let messageData;
        const orderStructSignature = "tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)";

        // Prepare the order object for encoding
        const order = {
            orderId: data.order.orderId,
            account: account,
            sqrtPrice: ethers.parseUnits(Math.sqrt(price).toString(), TOKENS[quoteAsset].decimals), // sqrt price used to compare with on-chain prices (e.g. on an AMM)
            amount: ethers.parseUnits(quantity.toString(), TOKENS[baseAsset].decimals),
            isBid: side === 'bid',
            baseAsset: TOKENS[baseAsset].address,
            quoteAsset: TOKENS[quoteAsset].address,
            quoteAmount: ethers.parseUnits((price * quantity).toString(), TOKENS[quoteAsset].decimals),
            isValid: true, // Not sure what this is for (prev: data['order']['isValid'])
            timestamp: timestamp.toString()
        };

        // Prepare messageData based on task ID
        if (data.taskId === 2 || data.taskId === 3) {
            messageData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature], [order]);
        } else if (data.taskId === 4) {
            const nextBestOrder = {
                orderId: data.nextBest.orderId,
                account: data.nextBest.account,
                sqrtPrice: ethers.parseUnits(Math.sqrt(data.nextBest.price).toString(), TOKENS[quoteAsset].decimals),
                amount: ethers.parseUnits(data.nextBest.quantity.toString(), TOKENS[baseAsset].decimals),
                isBid: data.nextBest.side === 'bid',
                baseAsset: TOKENS[baseAsset].address,
                quoteAsset: TOKENS[quoteAsset].address,
                quoteAmount: ethers.parseUnits((data.nextBest.price * data.nextBest.quantity).toString(), TOKENS[quoteAsset].decimals),
                isValid: true, // still not sure what this is for
                timestamp: timestamp.toString()
            };
            
            messageData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature, orderStructSignature], [order, nextBestOrder]);
        }
        // TODO: add check that no other task id was passed in

        // Prepare the proof of task
        const proofOfTask = `Task_${data.taskId}-Order_${data.order.orderId}-Timestamp_${timestamp}-Signature_${signature}`;
        
        // Send the task to the contract
        const result = await dalService.sendTaskToContract(proofOfTask, messageData, data.taskId);

        if (!result) {
            throw new CustomError("Error in forwarding task from Performer", {});
        }

        // Return successful response
        res.status(200).send(new CustomResponse({
            ...data,
            queuePosition: 0, // Currently processing
            message: `Order submitted successfully${data.taskId > 1 ? " and waiting for on-chain confirmation" : ""}`
        }));

        // For Task 2-4, we wait for the appropriate event (handled by the event listeners)
        // The event listeners will call unlockOrderBookAndProcessNextOrder when the event is received

    } catch (error) {
        console.error('Error processing order:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

// Copied from config.json in Frontend_Service, TODO move to repo base and reference that
const TOKENS = {
    "WETH": {
        "address": "0x138d34d08bc9Ee1f4680f45eCFb8fc8e4b0ca018",
        "decimals": 18
    },
    "USDC": {
        "address": "0x8b2f38De30098bA09d69bd080A3814F4aE536A22",
        "decimals": 6
    }
}

router.post("/limitOrder", async (req, res) => {
    try {
        // Extract order data from request
        const orderData = {
            account: req.body.account,
            price: req.body.price,
            quantity: req.body.quantity,
            side: req.body.side,
            baseAsset: req.body.baseAsset,
            quoteAsset: req.body.quoteAsset,
            signature: req.body.signature
        };

        // Check if order book is locked
        if (isOrderBookLocked) {
            // Add order to queue
            orderQueue.push({ orderData, res });
            
            // Respond with queued status
            return res.status(202).send(new CustomResponse({
                message: "Order queued for processing",
                queuePosition: orderQueue.length,
                estimatedWaitTime: `~${orderQueue.length * 15} seconds` // Rough estimate
            }));
        }

        // Process the order if order book is not locked
        await processOrder(orderData, res);
        
    } catch (error) {
        console.error('Error handling limit order:', error);
        
        // Ensure the order book is unlocked when an error occurs
        // This allows the system to process the next order in the queue
        isOrderBookLocked = false;
        currentProcessingOrderId = null;
        
        // Process next order in queue if any
        if (orderQueue.length > 0) {
            setTimeout(unlockOrderBookAndProcessNextOrder, 0);
        }
        
        return res.status(500).send(new CustomError(error.message || "Internal server error", error));
    }
});

// TODO
router.post("/cancelOrder", async (req, res) => {
    try {
        const { orderId, signature } = req.body;
        
        if (!orderId || !signature) {
            return res.status(400).send(new CustomError("Missing required parameters: orderId and signature", {}));
        }
        
        const orderData = {
            orderId: orderId,
            signature: signature
        };
        
        const result = await taskController.handleCancelOrder(orderData);
        
        return res.status(200).send(new CustomResponse({
            ...result,
            message: "Order successfully canceled"
        }));
    } catch (error) {
        console.error('Error canceling order:', error);
        return res.status(error.statusCode || 500).send(new CustomError(error.message || "Error canceling order", error.data || {}));
    }
});

// TODO
router.post("/orderBook", async (req, res) => {
    const { symbol } = req.body;

    try {
        const orderBook = await taskController.generateOrderBook(symbol);
        return res.status(200).send(new CustomResponse(orderBook));
    } catch (error) {
        console.log(error)
        return res.status(500).send(new CustomError("Something went wrong", {}));
    }
});

module.exports = router;
