"use strict";
const controller = require("./controller.js");
const { Router } = require("express");

const router = Router();

router.post("/limitOrder", (req, res) => {
    // accepts obj containing symbol, side, quantity, price
    const { symbol, side, quantity, price } = req.body;
    const order = controller.createOrder(symbol, side, quantity, price);
    res.status(200).json(order);

    // Work in progress ^^
});

router.get("/orderBook", (req, res) => {
    const symbol = req.query.symbol || "WBTC_USDC";
    const orderBook = generateOrderBook(symbol);
    res.status(200).json(orderBook);
});

module.exports = router;
