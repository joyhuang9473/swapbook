"use strict";
const orderBookDummyData = require("../utils/dummyData.js");

async function executeTask() {
    console.log("Executing task.....");
    try {
        const result = await oracleService.getFee();
        const cid = await dalService.publishJSONToIpfs({fee: result});
        const data = Math.floor(result * 1e6) ;
        await dalService.sendTask(cid, data, 0);
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
