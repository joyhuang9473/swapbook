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
        const result = await taskController.sendTask(data);

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
