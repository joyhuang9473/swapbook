"use strict";
const taskController = require("./task.controller.js");
const { Router } = require("express");
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");
const { ethers, AbiCoder } = require("ethers");
const dalService = require("./dal.service.js");

const router = Router();

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

// TODO: need to add signature by user on this stuff so that performer can't fake

// TODO: need to add checks that user has escrowed enough funds

// TODO: need to add lock on order book while order is being settled (+queue?)

router.post("/limitOrder", async (req, res) => {
    try {
        const { account, price, quantity, side, baseAsset, quoteAsset, signature } = req.body;

        // TODO: add check that signature corresponds to (price, quantity, side, baseAsset, quoteAsset) signed by account sender

        const timestamp = Date.now(); // Get the current timestamp in milliseconds

        const formData = new FormData();

        const quoteSymbol = taskController.token_address_symbol_mapping[quoteAsset];
        const baseSymbol = taskController.token_address_symbol_mapping[baseAsset];

        formData.append('payload', JSON.stringify({
            account: account,
            price: Number(price),
            quantity: Number(quantity),
            side: side,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            timestamp: timestamp
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
        if (data.taskId == 4 && data.nextBest == undefined) {
            // Complete order fill, need details of next best order on other side
            throw new CustomError(`Next best order details required for Complete Order Fill`, data);
        }

        // Should include order ID for newly inserted order
        if (data.order.orderId == undefined) {
            throw new CustomError(`Order ID not included`, data);
        }

        // Define Order struct to be passed to smart contract
        const order = {
            orderId: data.order.orderId,
            account: account,
            sqrtPrice: ethers.parseUnits(
                // First calculate sqrt, then format to limited decimal places to avoid overflow
                Math.sqrt(price).toFixed(TOKENS[quoteSymbol].decimals),
                TOKENS[quoteSymbol].decimals
            ),
            amount: ethers.parseUnits(quantity.toString(), TOKENS[baseSymbol].decimals),
            isBid: side == 'bid',
            baseAsset: TOKENS[baseSymbol].address,
            quoteAsset: TOKENS[quoteSymbol].address,
            quoteAmount: ethers.parseUnits(
                // Format price*quantity to limited decimal places as well
                (price * quantity).toFixed(TOKENS[quoteSymbol].decimals),
                TOKENS[quoteSymbol].decimals
            ),
            isValid: true,
            timestamp: timestamp.toString()
        }

        // Proof of Task from Execution Service is compared with Proof of Task from Validation Service later 
        const proofOfTask = `Task_${data.taskId}-Order_${data.order.orderId}-Timestamp_${timestamp}-Signature_${signature}`;
        
        // Format data to send on-chain
        // In case of task 1, nothing
        // In case of tasks 2 and 3, order
        // In case of task 4, order and next best order

        const orderStructSignature = "tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)";

        let messageData;

        if (data.taskId == 1) {
            // Task 1: need nothing (no-op)
            messageData = "";
        } else if (data.taskId == 2 || data.taskId == 3) {
            // Task 2: need order
            messageData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature], [order]);
        } else {
            // Task 4: need order and next best
            const nextBestOrder = {
                orderId: data.nextBest.orderId,
                account: data.nextBest.account,
                sqrtPrice: ethers.parseUnits(Math.sqrt(data.nextBest.price).toString(), TOKENS[quoteSymbol].decimals), // quote asset won't change
                amount: ethers.parseUnits(data.nextBest.quantity.toString(), TOKENS[baseSymbol].decimals),
                isBid: data.nextBest.side == 'bid',
                baseAsset: TOKENS[baseSymbol].address,
                quoteAsset: TOKENS[quoteSymbol].address,
                quoteAmount: ethers.parseUnits((data.nextBest.price * data.nextBest.quantity).toString(), TOKENS[quoteSymbol].decimals),
                isValid: true, // Not sure what this is for (prev: data['order']['isValid'])
                timestamp: timestamp.toString()
            };

            messageData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature, orderStructSignature], [order, nextBestOrder]);
        }

        // Function to pass task onto next step (validation service then chain)
        const result = await dalService.sendTaskToContract(proofOfTask, messageData, data.taskId);

        if (result) {
            return res.status(200).send(new CustomResponse(data));
        } else {
            return res.status(500).send(new CustomError("Error in forwarding task from Performer", {}));
        }

        // check if the order is filled
        // if (data['order']['trades'] && data['order']['trades'].length > 0) {
        //     var fillOrderData = JSON.parse(JSON.stringify(data)); // Create a deep copy

        //     for (const trade of fillOrderData['order']['trades']) {
        //         // trade: {'timestamp': 2, 'price': 50000.0, 'quantity': 1.0, 'time': 2, 'party1': ['0x1234567890123456789012345678901234567891', 'ask', 1, None], 'party2': ['0x1234567890123456789012345678901234567890', 'bid', None, None]}
        //         // party: [trade_id, side, head_order.order_id, new_book_quantity]
        //         fillOrderData['order']['quantity'] = trade['quantity'];


        //         // MAY FAIL HERE: just do one part for now
        //         result |= await taskController.sendFillOrderTask(fillOrderData);

        //         if (!result) {
        //             return res.status(500).send(new CustomError("sendFillOrderTask went wrong", {}));
        //         }
        //     }

        //     // update the best price
        //     // MAY FAIL HERE: just do one part for now
        //     const opposite_side = side === 'bid' ? 'ask' : 'bid';
        //     const _data = await taskController.getBestOrder(baseAsset, quoteAsset, opposite_side);
        //     result |= await taskController.sendUpdateBestPriceTask(_data);
        // }

    } catch (error) {
        console.error('Error processing limit order:', error);
        return res.status(500).send(new CustomError(error.message || "Internal server error", error));
    }
});

// TODO
router.post("/cancelOrder", async (req, res) => {
    const { orderId, side, baseAsset, quoteAsset } = req.body;
    try {
        const data = await taskController.cancelOrder(orderId, side, baseAsset, quoteAsset);
        const result = await taskController.sendCancelOrderTask(data);

        if (result) {
            return res.status(200).send(new CustomResponse(data));
        } else {
            return res.status(500).send(new CustomError("Something went wrong", {}));
        }
    } catch (error) {
        console.log(error)
        return res.status(500).send(new CustomError("Something went wrong", {}));
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
