require('dotenv').config();
const taskController = require("./task.controller");
const { ethers, AbiCoder } = require("ethers");

async function validate(proofOfTask, data, taskDefinitionId) {
    try {
        let isApproved = false;

        if (taskDefinitionId === taskController.taskDefinitionId.CreateOrder) {
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid)'],
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
                quoteAmount,
                isValid
            } = decodedData[0];
            const price = Math.pow(
                Number(ethers.formatUnits(sqrtPrice, taskController.decimal)),
                2
            );
            const side = isBid ? 'bid' : 'ask';

            // turn address to symbol
            const baseAssetSymbol = taskController.token_address_symbol_mapping[baseAsset];
            const quoteAssetSymbol = taskController.token_address_symbol_mapping[quoteAsset];
            const amountFormatted = Number(ethers.formatUnits(amount, taskController.decimal));

            const taskResult = await taskController.createOrder(account, price, amountFormatted, side, baseAssetSymbol, quoteAssetSymbol);
            if (taskResult['order']['order_id'].toString() === proofOfTask) {
                isApproved = true;
            }
        } else if (taskDefinitionId === taskController.taskDefinitionId.FillOrder) {
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid)'],
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
                quoteAmount,
                isValid
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
        } else if (taskDefinitionId === taskController.taskDefinitionId.UpdateBestPrice) {
            const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid)'],
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
                quoteAmount,
                isValid
            } = decodedData[0];

            if (orderId.toString() === proofOfTask) {
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