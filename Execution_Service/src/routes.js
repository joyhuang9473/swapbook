"use strict";
const taskController = require("./task.controller.js");
const { Router } = require("express");
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");
const dalService = require("./dal.service.js");
const { ethers } = require("ethers");

const router = Router();

router.post("/limitOrder", async (req, res) => {
    const { account, price, quantity, side, baseAsset, quoteAsset } = req.body;
    
    try {
        const result = await taskController.createOrder(account, price, quantity, side, baseAsset, quoteAsset);
        if (result.status == 200) {
            const order = {
                orderId: result['order']['order_id'],
                account: result['order']['account'],
                sqrtPrice: ethers.parseUnits(Math.sqrt(result['order']['price']).toString(), decimal),
                amount: ethers.parseUnits(result['order']['quantity'].toString(), decimal),
                isBid: result['order']['side'] === 'bid',
                baseAsset: token_address_mapping[result['order']['baseAsset']],
                quoteAsset: token_address_mapping[result['order']['quoteAsset']],
                quoteAmount: ethers.parseUnits((result['order']['price'] * result['order']['quantity']).toString(), decimal)
            }
        
            await dalService.sendTask(order.orderId.toString(), order, taskController.taskDefinitionId.UpdateBest);

            return res.status(200).send(new CustomResponse(result));
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
