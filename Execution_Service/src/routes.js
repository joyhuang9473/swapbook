"use strict";
const taskController = require("./task.controller.js");
const { Router } = require("express");
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");

const router = Router();

router.post("/limitOrder", async (req, res) => {
    const { account, price, quantity, side, baseAsset, quoteAsset } = req.body;
    
    try {
        const data = await taskController.createOrder(account, price, quantity, side, baseAsset, quoteAsset);
        var result = await taskController.sendCreateOrderTask(data);

        // check if the order is filled
        if (data['trades'] && data['trades'].length > 0) {
            var fillOrderData = JSON.parse(JSON.stringify(data)); // Create a deep copy

            for (const trade of fillOrderData['trades']) {
                // trade: {'timestamp': 2, 'price': 50000.0, 'quantity': 1.0, 'time': 2, 'party1': ['0x1234567890123456789012345678901234567891', 'ask', 1, None], 'party2': ['0x1234567890123456789012345678901234567890', 'bid', None, None]}
                // party: [trade_id, side, head_order.order_id, new_book_quantity]
                fillOrderData['order']['quantity'] = trade['quantity'];

                result = await taskController.sendFillOrderTask(fillOrderData);

                if (!result) {
                    return res.status(500).send(new CustomError("sendFillOrderTask went wrong", {}));
                }
            }

            // update the best price
            const opposite_side = side === 'bid' ? 'ask' : 'bid';
            const _data = await taskController.getBestOrder(baseAsset, quoteAsset, opposite_side);
            result = await taskController.sendTask(_data);
        }

        if (result) {
            return res.status(200).send(new CustomResponse(data));
        } else {
            return res.status(500).send(new CustomError("sendUpdateBestTask went wrong", {}));
        }
    } catch (error) {
        console.log(error)
        return res.status(500).send(new CustomError("Something went wrong", {}));
    }
});

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
