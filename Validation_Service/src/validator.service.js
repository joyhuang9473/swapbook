require('dotenv').config();
const taskController = require("./task.controller");
const { ethers, AbiCoder } = require("ethers");

// The validator should:
// Receive the (proof of task, data, task definition id)
// Run the order (found in data) through their own order book
// Generate a task id from running the order through their order book
// Generate a proof of task from the order book
// Verify their order book suggests the same task id as the one provided by the performer

// When sending order to order book should get result, one of:
// Task 1: Order does not cross spread and is not best price
// Task 2: Order does not cross spread but is best price
// Task 3: Order crosses spread and partially fills best price
// Task 4: Order crosses spread and completely fills best price (params: next best price order on opposite side)
// Failure: Order crosses spread and fills more than best price (API call fails)

async function validate(proofOfTask, data, taskDefinitionId) {
    try {
        // Check sender signature

        const proofParts = proofOfTask.split("_")[3];
        const timestampStr = proofParts[2];
        const signatureStr = proofParts[3];

        const timestamp = timestampStr.split("-")[1];
        const signature = signatureStr.split("-")[1];

        // TODO: add check that signature corresponds to data in order signed by data.account

        // Send order to order book

        const formData = new FormData();

        formData.append('payload', JSON.stringify({
            account: account,
            price: Number(price),
            quantity: Number(quantity),
            side: side,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            timestamp: timestamp
        }));

        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/register_order`, {
            method: 'POST',
            body: formData
        });
        const new_data = await response.json(); // if it doesn't work try JSON.parse(JSON.stringify(data))


        // Run same checks as Execution Service

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
        if (new_data.order.orderId == undefined) {
            throw new CustomError(`Order ID not included`, data);
        }

        // Get new proof of task

        const new_proofOfTask = `Task_${new_data.taskId}-Order_${new_data.order.orderId}-Timestamp_${timestamp}-Signature_${signature}`;

        return proofOfTask === new_proofOfTask; // isApproved

        // let isApproved = false;

        // if (taskDefinitionId === taskController.taskDefinitionId.CreateOrder) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         account,
        //         sqrtPrice,
        //         amount,
        //         isBid,
        //         baseAsset,
        //         quoteAsset,
        //         quoteAmount,
        //         isValid,
        //         timestamp
        //     } = decodedData[0];
        //     const price = Math.pow(
        //         Number(ethers.formatUnits(sqrtPrice, taskController.decimal)),
        //         2
        //     );
        //     const side = isBid ? 'bid' : 'ask';

        //     // turn address to symbol
        //     const baseAssetSymbol = taskController.token_address_symbol_mapping[baseAsset];
        //     const quoteAssetSymbol = taskController.token_address_symbol_mapping[quoteAsset];
        //     const amountFormatted = Number(ethers.formatUnits(amount, taskController.decimal));
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));

        //     const taskResult = await taskController.createOrder(account, price, amountFormatted, side, baseAssetSymbol, quoteAssetSymbol, timestampFormatted);
        //     const predictedProofOfTask = `CreateOrder-${side}-${taskResult['order']['order_id']}-${timestampFormatted}`;

        //     if (predictedProofOfTask === proofOfTask) {
        //         isApproved = true;
        //     }
        // } else if (taskDefinitionId === taskController.taskDefinitionId.FillOrder) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         account,
        //         sqrtPrice,
        //         amount,
        //         isBid,  
        //         baseAsset,
        //         quoteAsset,
        //         quoteAmount,
        //         isValid,
        //         timestamp
        //     } = decodedData[0];
        //     const side = isBid ? 'bid' : 'ask';
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));
        //     const predictedProofOfTask = `FillOrder-${side}-${orderId}-${timestampFormatted}`;

        //     if (predictedProofOfTask === proofOfTask) {
        //         isApproved = true;  
        //     }
        // } else if (taskDefinitionId === taskController.taskDefinitionId.CancelOrder) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, bool isBid, address baseAsset, address quoteAsset, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         isBid,
        //         baseAsset,
        //         quoteAsset,
        //         timestamp
        //     } = decodedData[0];
        //     const side = isBid ? 'bid' : 'ask';
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));

        //     const taskResult = await taskController.cancelOrder(orderId, side, baseAsset, quoteAsset);
        //     const predictedProofOfTask = `CancelOrder-${side}-${taskResult['order']['order_id']}-${timestampFormatted}`;

        //     if (predictedProofOfTask=== proofOfTask) {
        //         isApproved = true;
        //     }
        // } else if (taskDefinitionId === taskController.taskDefinitionId.UpdateBestPrice) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         account,
        //         sqrtPrice,
        //         amount,
        //         isBid,  
        //         baseAsset,
        //         quoteAsset,
        //         quoteAmount,
        //         isValid,
        //         timestamp
        //     } = decodedData[0];
        //     const side = isBid ? 'bid' : 'ask';
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));
        //     const predictedProofOfTask = `UpdateBestPrice-${side}-${orderId}-${timestampFormatted}`;

        //     if (predictedProofOfTask === proofOfTask) {
        //         isApproved = true;  
        //     }
        // }

        // return isApproved;
    } catch (err) {
        console.error(err?.message);
        return false;
    }
}
  
module.exports = {
    validate,
}