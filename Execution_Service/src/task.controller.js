"use strict";
const oracleService = require("./oracle.service");
const dalService = require("./dal.service");

const taskDefinitionId = {
    KEEP_ALIVE: 0,
    MAKE_ORDER: 1,
    FILL_ORDER: 2,
    CANCEL_ORDER: 3,
}

async function executeTask() {
    console.log("Executing task.....");
    try {
        const result = await oracleService.getFee();
        const cid = await dalService.publishJSONToIpfs({fee: result});
        const data = Math.floor(result * 1e6) ;
        await dalService.sendTask(cid, data, taskDefinitionId.KEEP_ALIVE);
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
