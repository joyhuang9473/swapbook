"use strict";
const taskController = require("./task.controller.js");
const { Router } = require("express");
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");
const { ethers, AbiCoder } = require("ethers");

const P2POrderBookABI = require("./abi/P2POrderBookABI");
const dalService = require("./dal.service.js");
require('dotenv').config();

const router = Router();

// Order processing queue and lock management
const orderQueue = [];
let isOrderBookLocked = false;
let currentProcessingOrderId = null;
let currentProcessingWithdrawalId = null;

// Setup contract event polling for order settlement events
async function setupContractEventPolling() {
    const avsHookAddress = process.env.AVS_HOOK_ADDRESS;
    if (!avsHookAddress) {
        throw new CustomError("AVS_HOOK_ADDRESS environment variable is not set");
    }

    // Initialize ethers provider
    const provider = new ethers.JsonRpcProvider(process.env.L2_RPC_URL);
    
    if (!provider) {
        throw new CustomError("Failed to initialize provider", {});
    }
    const avsHookContract = new ethers.Contract(avsHookAddress, P2POrderBookABI, provider);

    // Start polling for events
    setInterval(async () => {
        try {
            // Get the latest block number
            const latestBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, latestBlock - 10); // Look back 10 blocks

            // Split event queries into two batches to stay within the 3-request limit
            const events1 = await Promise.all([
                avsHookContract.queryFilter('UpdateBestOrder', fromBlock),
                avsHookContract.queryFilter('PartialFillOrder', fromBlock)
            ]);

            const events2 = await Promise.all([
                avsHookContract.queryFilter('CompleteFillOrder', fromBlock),
                avsHookContract.queryFilter('WithdrawalProcessed', fromBlock)
            ]);

            // Combine the results
            const events = [...events1, ...events2];

            // Process UpdateBestOrder events
            for (const event of events[0]) {
                const [orderId, maker, baseAsset, quoteAsset, sqrtPrice, amount] = event.args;
                handleUpdateBestOrder(orderId, maker, baseAsset, quoteAsset, sqrtPrice, amount);
            }

            // Process PartialFillOrder events
            for (const event of events[1]) {
                const [takerOrderId, makerOrderId] = event.args;
                handlePartialFillOrder(takerOrderId, makerOrderId);
            }

            // Process CompleteFillOrder events
            for (const event of events[2]) {
                const [makerOrderId, takerOrderId] = event.args;
                handleCompleteFillOrder(makerOrderId, takerOrderId);
            }

            // Process WithdrawalProcessed events
            for (const event of events[3]) {
                const [account, asset, amount] = event.args;
                handleWithdrawalProcessed(account, asset, amount);
            }
        } catch (error) {
            console.error('Error polling for events:', error);
        }
    }, 5000); // Poll every 5 seconds
}

// Event handling functions
function handleUpdateBestOrder(orderId, maker, baseAsset, quoteAsset, sqrtPrice, amount) {
    console.log(`UpdateBestOrder event received for order ID: ${orderId}`);
    
    if (!currentProcessingOrderId) {
        console.error(`Received UpdateBestOrder event for order ID ${orderId} but no order is currently being processed`);
        return;
    }
    
    if (orderId.toString() !== currentProcessingOrderId) {
        console.error(`Received UpdateBestOrder event for unexpected order ID: ${orderId}, expected: ${currentProcessingOrderId}`);
        return;
    }
    
    unlockOrderBookAndProcessNextOrder();
}

// Similar handler functions for other events...
function handlePartialFillOrder(takerOrderId, makerOrderId) {
    // Similar to previous setupPartialFillOrderListener logic
}

function handleCompleteFillOrder(makerOrderId, takerOrderId) {
    // Similar to previous setupCompleteFillOrderListener logic
}

function handleWithdrawalProcessed(account, asset, amount) {
    // Similar to previous setupWithdrawalProcessedListener logic
}

// Initialize polling
setupContractEventPolling().catch(console.error);

// Function to unlock order book and process the next order in the queue
async function unlockOrderBookAndProcessNextOrder() {
    console.log("Unlocking order book and processing next order...");
    currentProcessingOrderId = null;
    currentProcessingWithdrawalId = null;
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
        "address": process.env.WETH_ADDRESS,
        "decimals": 18
    },
    "USDC": {
        "address": process.env.USDC_ADDRESS,
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
        
        // TODO: add check that signature corresponds to (price, quantity, side, baseAsset, quoteAsset) signed by account sender
        if (orderData['signature'] == undefined) {
            orderData['signature'] = "";
        }

        const formData = new FormData();

        const quoteSymbol = taskController.token_address_symbol_mapping[orderData['quoteAsset']];
        const baseSymbol = taskController.token_address_symbol_mapping[orderData['baseAsset']];

        formData.append('payload', JSON.stringify({
            account: orderData['account'],
            price: Number(orderData['price']),
            quantity: Number(orderData['quantity']),
            side: orderData['side'],
            baseAsset: orderData['baseAsset'],
            quoteAsset: orderData['quoteAsset'],
            timestamp: Number(Date.now())
        }));

        // Send order to order book and get result, one of:
        // Task 1: Order does not cross spread and is not best price
        // Task 2: Order does not cross spread but is best price
        // Task 3: Order crosses spread and partially fills best price
        // Task 4: Order crosses spread and completely fills best price (params: next best price order on opposite side)
        // Failure: Order crosses spread and fills more than best price (API call fails)
        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/register_order`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json(); // if it doesn't work try JSON.parse(JSON.stringify(data))

        // Check nothing's failed badly
        if (!response.ok) {
            const errorMessage = data.error || data.message || `Failed to create order: HTTP status ${response.status}`;
            throw new CustomError(errorMessage, data);
        }

        // Check we haven't failed to enter order into order book (e.g. if incoming order is larger than best order)
        if (data.status_code == 0) {
            throw new CustomError(`Failed to create order: ${data.message}`, data);
        }

        // Check task ID determined is between 1 and 4 inclusive
        if (data.taskId > 4 || data.taskId < 1) {
            throw new CustomError(`Invalid task ID returned from Order Book Service: ${data.taskId}`, data);
        }

        // Check the necessary data is included correctly from the Order Book (only task 4)
        // if (data.taskId == 4 && data.nextBest == undefined) {
            // Complete order fill, need details of next best order on other side
            // throw new CustomError(`Next best order details required for Complete Order Fill`, data);
        // }

        // Should include order ID for newly inserted order
        if (data.order.orderId == undefined) {
            throw new CustomError(`Order ID not included`, data);
        }

        // Define Order struct to be passed to smart contract
        const order = {
            orderId: data.order.orderId,
            account: data.order.account,
            sqrtPrice: ethers.parseUnits(
                Math.sqrt(data.order.price).toFixed(6),
                TOKENS[quoteSymbol].decimals
            ),
            amount: ethers.parseUnits(data.order.quantity.toString(), TOKENS[baseSymbol].decimals),
            isBid: data.order.side == 'bid',
            baseAsset: TOKENS[baseSymbol].address,
            quoteAsset: TOKENS[quoteSymbol].address,
            quoteAmount: ethers.parseUnits( 
                // Format price*quantity to limited decimal places as well
                (data.order.price * data.order.quantity).toString(),
                TOKENS[quoteSymbol].decimals
            ),
            isValid: true,
            timestamp: ethers.parseUnits(data.order.timestamp.toString(), TOKENS[baseSymbol].decimals)
        }

        // Proof of Task from Execution Service is compared with Proof of Task from Validation Service later 
        const proofOfTask = `Task_${data.taskId}-Order_${data.order.orderId}-Timestamp_${data.order.timestamp.toString()}-Signature_${orderData['signature']}`;

        // Format data to send on-chain
        // In case of task 1, nothing
        // In case of tasks 2 and 3, order
        // In case of task 4, order and next best order

        const orderStructSignature = "tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)";

        let messageData;

        if (data.taskId == 1) {
            // Task 1: do nothing onchain(no-op)
            messageData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature], [order]);
        } else if (data.taskId == 2 || data.taskId == 3) {
            // Task 2: need order
            messageData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature], [order]);
        } else if (data.taskId == 4) {
            let nextBestOrder = null;

            if (data.nextBest == undefined) {
                nextBestOrder = {
                    orderId: data.order.orderId,
                    account: data.order.account,
                    sqrtPrice: ethers.parseUnits(Math.sqrt(data.order.price).toString(), TOKENS[quoteSymbol].decimals), // quote asset won't change
                    amount: ethers.parseUnits(data.order.quantity.toString(), TOKENS[baseSymbol].decimals),
                    isBid: data.order.side == 'bid',
                    baseAsset: TOKENS[baseSymbol].address,
                    quoteAsset: TOKENS[quoteSymbol].address,
                    quoteAmount: ethers.parseUnits((data.order.price * data.order.quantity).toString(), TOKENS[quoteSymbol].decimals),
                    isValid: false, // just clean up the best price in the contract
                    timestamp: ethers.parseUnits(data.order.timestamp, TOKENS[baseSymbol].decimals)
                }
            } else {
                // Task 4: need order and next best
                nextBestOrder = {
                    orderId: data.nextBestOrder.orderId,
                    account: data.nextBestOrder.account,
                    sqrtPrice: ethers.parseUnits(Math.sqrt(data.nextBestOrder.price).toString(), TOKENS[quoteSymbol].decimals), // quote asset won't change
                    amount: ethers.parseUnits(data.nextBestOrder.quantity.toString(), TOKENS[baseSymbol].decimals),
                    isBid: data.nextBestOrder.side == 'bid',
                    baseAsset: TOKENS[baseSymbol].address,
                    quoteAsset: TOKENS[quoteSymbol].address,
                    quoteAmount: ethers.parseUnits((data.nextBestOrder.price * data.nextBestOrder.quantity).toString(), TOKENS[quoteSymbol].decimals),
                    isValid: true,
                    timestamp: ethers.parseUnits(data.nextBestOrder.timestamp, TOKENS[baseSymbol].decimals)
                };
            }

            messageData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature, orderStructSignature], [order, nextBestOrder]);
        }

        // Function to pass task onto next step (validation service then chain)
        const result = await dalService.sendTaskToContract(proofOfTask, messageData, data.taskId);

        if (result) {
            return res.status(200).send(new CustomResponse(data));
        } else {
            return res.status(500).send(new CustomError("Error in forwarding task from Performer", {}));
        }

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

router.post("/initiateWithdrawal", async (req, res) => {
    try {
        const { account, asset, amount, signature } = req.body;
        
        if (!account || !asset || !amount || !signature) {
            return res.status(400).send(new CustomError("Missing required parameters: account, asset, amount, and signature", {}));
        }

        // Create the message that should have been signed by the user
        const withdrawalMessage = `Withdraw ${amount} of token ${asset}`;
        
        // Verify the signature
        const messageHash = ethers.hashMessage(withdrawalMessage);
        const recoveredAddress = ethers.recoverAddress(messageHash, signature);
        
        if (recoveredAddress.toLowerCase() !== account.toLowerCase()) {
            return res.status(401).send(new CustomError("Invalid signature", {}));
        }
        
        // Create withdrawal data
        const withdrawalData = {
            account,
            asset,
            amount: ethers.parseUnits(amount.toString(), asset === taskController.token_symbol_address_mapping['WETH'] ? 18 : 6)
        };

        // Check if funds are available in escrow and not locked in orders
        const avsHookAddress = process.env.AVS_HOOK_ADDRESS;
        if (!avsHookAddress) {
            throw new CustomError("AVS_HOOK_ADDRESS environment variable is not set");
        }
        // Initialize ethers provider for contract events
        const provider = new ethers.JsonRpcProvider(process.env.L2_RPC_URL);
        if (!provider) {
            throw new CustomError("Failed to initialize provider", {});
        }
        const avsHookContract = new ethers.Contract(avsHookAddress, P2POrderBookABI, provider);
    
        // Check on-chain escrow balance
        const escrowedBalance = await avsHookContract.escrowedFunds(account, asset);
        if (escrowedBalance < withdrawalData.amount) {
            return res.status(400).send(new CustomError("Insufficient funds in escrow", {}));
        }

        // Call to order book service to check if funds are locked in open orders
        const formData = new FormData();
        formData.append('payload', JSON.stringify({
            account,
            asset
        }));
        
        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/check_available_funds`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).send(new CustomError(errorData.error || "Failed to check available funds", {}));
        }
        
        const fundData = await response.json();
        
        if (fundData.lockedAmount && ethers.parseUnits(fundData.lockedAmount.toString(), TOKENS[asset].decimals) + withdrawalData.amount > escrowedBalance) {
            return res.status(400).send(new CustomError("Funds are locked in open orders", {}));
        }
        
        // Check if order book is locked
        if (isOrderBookLocked) {
            // Add withdrawal task to queue
            orderQueue.push({ 
                type: 'withdrawal', 
                data: { account, asset, amount, signature }, 
                res 
            });
            
            // Respond with queued status
            return res.status(202).send(new CustomResponse({
                message: "Withdrawal queued for processing",
                queuePosition: orderQueue.length,
                estimatedWaitTime: `~${orderQueue.length * 15} seconds` // Rough estimate
            }));
        }
        
        // Lock the order book before processing
        isOrderBookLocked = true;
        
        // Generate unique withdrawal ID and timestamp
        const timestamp = Date.now();
        const withdrawalId = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "address", "uint256", "uint256"],
                [account, asset, withdrawalData.amount, timestamp]
            )
        );
        
        // Set the current processing withdrawal ID
        currentProcessingWithdrawalId = withdrawalId;

        // Prepare withdrawal task proof
        const proofOfTask = `Withdrawal_${withdrawalId}_User_${account}_Asset_${asset}_Amount_${amount}_Timestamp_${timestamp}_Signature_${signature}`;
        
        // Send the task to the Validation Service and contract
        // Create withdrawal data - encode it properly for the contract
         const encodedWithdrawalData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint256"],
            [account, asset, ethers.parseUnits(amount.toString(), asset === taskController.token_symbol_address_mapping['WETH'] ? 18 : 6)]
        );
        const result = await dalService.sendTaskToContract(proofOfTask, encodedWithdrawalData, 5);
        
        if (!result) {
            throw new CustomError("Error in processing withdrawal", {});
        }
        
        return res.status(200).send(new CustomResponse({
            withdrawalId,
            account,
            asset,
            amount,
            timestamp,
            message: "Withdrawal initiated successfully"
        }));
        
    } catch (error) {
        console.error('Error processing withdrawal request:', error);
        
        // Ensure the order book is unlocked when an error occurs
        isOrderBookLocked = false;
        currentProcessingWithdrawalId = null;
        
        // Process next order in queue if any
        if (orderQueue.length > 0) {
            setTimeout(unlockOrderBookAndProcessNextOrder, 0);
        }
        
        return res.status(error.statusCode || 500).send(new CustomError(error.message || "Error processing withdrawal", error.data || {}));
    }
});

module.exports = router;
