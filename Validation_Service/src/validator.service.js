require('dotenv').config();
const taskController = require("./task.controller");
const { ethers, AbiCoder } = require("ethers");

async function validate(proofOfTask, data, taskDefinitionId) {
    try {
        let isApproved = false;

        if (taskDefinitionId === taskController.taskDefinitionId.CreateOrder) {
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount)'],
                data
            );
            const {
                orderId,
                account,
                sqrtPrice,
                amount,
                isBid,
                baseAsset,
                quoteAsset,
                quoteAmount
            } = decodedData[0];
            const price = Math.pow(
                Number(ethers.formatUnits(sqrtPrice, taskController.decimal)),
                2
            );
            const side = isBid ? 'bid' : 'ask';
    
            const taskResult = await taskController.createOrder(account, price, amount, side, baseAsset, quoteAsset);
            if (taskResult['order']['order_id'].toString() === proofOfTask) {
                isApproved = true;
            }
        } else if (taskDefinitionId === taskController.taskDefinitionId.FillOrder) {
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount)'],
                data
            );
            const {
                orderId,
                account,
                sqrtPrice,
                amount,
                isBid,  
                baseAsset,
                quoteAsset,
                quoteAmount
            } = decodedData[0];

            if (orderId.toString() === proofOfTask) {
                isApproved = true;  
            }
        } else if (taskDefinitionId === taskController.taskDefinitionId.CancelOrder) {
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ['tuple(uint256 orderId, bool isBid, address baseAsset, address quoteAsset)'],
                data
            );
            const {
                orderId,
                isBid,
                baseAsset,
                quoteAsset
            } = decodedData[0];
            const side = isBid ? 'bid' : 'ask';

            const taskResult = await taskController.cancelOrder(orderId, side, baseAsset, quoteAsset);
            if (taskResult['order']['order_id'].toString() === proofOfTask) {
                isApproved = true;
            }
        }

        return isApproved;
    } catch (err) {
        console.error(err?.message);
        return false;
    }
}
  
module.exports = {
    validate,
}