"use strict";
const orderBookDummyData = require("./utils/dummyData.js");

const taskDefinitionId = {
    KEEP_ALIVE: 0,
    MAKE_ORDER: 1,
    FILL_ORDER: 2,
    CANCEL_ORDER: 3,
}

function generateOrderBook(symbol) {
    return orderBookDummyData;
}

async function createOrder(symbol, side, quantity, price) {

}

async function executeTask() {
    console.log("Executing task.....");
}

function start() {
    setTimeout(() => {
        executeTask(); 

        setInterval(() => {
            executeTask(); 
        }, 60 * 1000); 
    }, 10000); 
}

module.exports = { start };
