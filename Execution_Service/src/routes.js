"use strict";
const oracleService = require("./oracle.service");
const dalService = require("./dal.service");
const orderBookDummyData = require("./utils/dummyData.js");
const { Router } = require("express");

const router = Router();

router.get("/orderBook", (req, res) => {
    const symbol = req.query.symbol || "WBTC_USDC";
    const orderBook = generateOrderBook(symbol);
    res.status(200).json(orderBook);
});

function generateOrderBook(symbol) {
    return orderBookDummyData;
}

module.exports = router;
