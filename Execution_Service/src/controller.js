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
    try {
        // executeTask called when submitting an order
        // Get order data and signature
        // call: await dalService.sendTask(signature, orderData, 0);

        // Previous code:
        // const result = await oracleService.getFee();
        // const cid = await dalService.publishJSONToIpfs({fee: result});
        // const data = Math.floor(result * 1e6) ;
        // await dalService.sendTask(cid, data, 0);
    } catch (error) {
        console.log(error)
    }
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
