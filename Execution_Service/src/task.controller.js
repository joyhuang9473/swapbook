"use strict";
require("dotenv").config();
const dalService = require("./dal.service.js");
const { ethers } = require("ethers");
const CustomError = require("./utils/validateError");

// Old definition
// const taskDefinitionId = {
//     Origin: 0,
//     // new task: start from 1
//     UpdateBestPrice: 1,
//     FillOrder: 2,
//     ProcessWithdrawal: 3,
//     CancelOrder: 4,
//     CreateOrder: 5,
// }
const taskDefinitionId = {
    Origin: 0,
    Task1: 1,
    Task2: 2,
    Task3: 3,
    Task4: 4,
    Task5: 5,
}

const decimal = 18;

const token_symbol_address_mapping = {
    'WETH': process.env.WETH_ADDRESS,
    'USDC': process.env.USDC_ADDRESS,
}
const token_address_symbol_mapping = {
    [process.env.WETH_ADDRESS]: 'WETH',
    [process.env.USDC_ADDRESS]: 'USDC',
}

// async function createOrder(account, price, quantity, side, baseAsset, quoteAsset, timestamp=0) {
//     // Create form data
//     const formData = new FormData();
//     if (timestamp !== 0) {
//         formData.append('payload', JSON.stringify({
//             account: account,
//             price: Number(price),
//             quantity: Number(quantity),
//             side: side,
//             baseAsset: baseAsset,
//             quoteAsset: quoteAsset,
//             timestamp: timestamp
//         }));
//     } else {
//         formData.append('payload', JSON.stringify({
//             account: account,
//             price: Number(price),
//             quantity: Number(quantity),
//             side: side,
//             baseAsset: baseAsset,
//             quoteAsset: quoteAsset
//         }));
//     }

//     const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/register_order`, {
//         method: 'POST',
//         body: formData
//     });

//     if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || `Failed to create order: ${response.status}`);
//     }

//     let data = await response.json();
//     return data;
// }

async function handleCancelOrder(orderData) {
    try {
        const { orderId, signature } = orderData;
        
        // Step 1: Get the order details from the order book
        const formData = new FormData();
        formData.append('payload', JSON.stringify({
            orderId: orderId
        }));

        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/order`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new CustomError(errorData.error || `Failed to fetch order: ${response.status}`, errorData);
        }

        const orderInfo = await response.json();
        
        if (!orderInfo.order || orderInfo.status_code === 0) {
            throw new CustomError("Order not found", { orderId });
        }

        const order = orderInfo.order;
        const account = order.account;
        
        // Step 2: Verify the signature
        // Create the message that should have been signed
        const cancelMessage = `Cancel order ${orderId}`;
        
        // Get message hash - must match the exact method used in frontend with MetaMask
        const messageHash = ethers.hashMessage(cancelMessage);

        // Recover the address from the signature
        let recoveredAddress;
        try {
            recoveredAddress = ethers.recoverAddress(messageHash, signature);
        } catch (error) {
            throw new CustomError("Invalid signature format", { error: error.message });
        }

        // Verify that the recovered address matches the account in the request
        if (recoveredAddress.toLowerCase() !== account.toLowerCase()) {
            throw new CustomError("Signature verification failed: signer does not match order creator", {
                orderCreator: account,
                recoveredSigner: recoveredAddress
            });
        }

        // Step 3: Call order book service to cancel the order
        const cancelFormData = new FormData();
        cancelFormData.append('payload', JSON.stringify({
            orderId: orderId,
            side: order.side,
            baseAsset: order.baseAsset,
            quoteAsset: order.quoteAsset
        }));

        const cancelResponse = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/cancel_order`, {
            method: 'POST',
            body: cancelFormData
        });

        if (!cancelResponse.ok) {
            const errorData = await cancelResponse.json();
            throw new CustomError(errorData.error || `Failed to cancel order: ${cancelResponse.status}`, errorData);
        }

        const cancelData = await cancelResponse.json();

        // Step 4: If this was the best order on-chain, update to the next best
        if (cancelData.wasBestOrder) {
            // Get the next best order
            const bestOrderFormData = new FormData();
            bestOrderFormData.append('payload', JSON.stringify({
                side: order.side,
                baseAsset: order.baseAsset,
                quoteAsset: order.quoteAsset
            }));

            const bestOrderResponse = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/get_best_order`, {
                method: 'POST',
                body: bestOrderFormData
            });

            if (!bestOrderResponse.ok) {
                const errorData = await bestOrderResponse.json();
                throw new CustomError(errorData.error || `Failed to get best order: ${bestOrderResponse.status}`, errorData);
            }

            const bestOrderData = await bestOrderResponse.json();
            
            // If there's a new best order, update it on-chain
            if (bestOrderData.order && bestOrderData.status_code === 1) {
                const nextBestOrder = {
                    orderId: bestOrderData.order.order_id,
                    account: bestOrderData.order.account,
                    sqrtPrice: ethers.parseUnits(Math.sqrt(bestOrderData.order.price).toString(), decimal),
                    amount: ethers.parseUnits(bestOrderData.order.quantity.toString(), decimal),
                    isBid: bestOrderData.order.side === 'bid',
                    baseAsset: token_symbol_address_mapping[bestOrderData.order.baseAsset],
                    quoteAsset: token_symbol_address_mapping[bestOrderData.order.quoteAsset],
                    quoteAmount: ethers.parseUnits((bestOrderData.order.price * bestOrderData.order.quantity).toString(), decimal),
                    isValid: true,
                    timestamp: Date.now().toString()
                };
                
                // Prepare the task
                const proofOfTask = `UpdateBestPrice-CancelOrder-${orderId}-${nextBestOrder.orderId}-${Date.now()}`;
                const orderStructSignature = "tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)";
                const encodedData = ethers.AbiCoder.defaultAbiCoder().encode([orderStructSignature], [nextBestOrder]);

                // Send update best order task to contract through AVS
                const updateResult = await dalService.sendTaskToContract(proofOfTask, encodedData, 2);

                if (!updateResult) {
                    throw new CustomError("Failed to update best order on-chain", {});
                }

                // Return the cancel data with information about updating the best order
                return {
                    ...cancelData,
                    bestOrderUpdated: true,
                    newBestOrderId: nextBestOrder.orderId
                };
            } else {
                // No new best order available
                return {
                    ...cancelData,
                    bestOrderUpdated: false,
                    message: "Order canceled. No new best order available."
                };
            }
        }
        
        // Return the cancel data
        return cancelData;
        
    } catch (error) {
        console.error('Error handling cancel order:', error);
        throw error;
    }
}

async function generateOrderBook(symbol) {
    // Create form data
    const formData = new FormData();
    formData.append('payload', JSON.stringify({
        symbol: symbol,
    }));

    const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/orderbook`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create order: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

async function getBestOrder(baseAsset, quoteAsset, side) {
    // Create form data
    const formData = new FormData();
    formData.append('payload', JSON.stringify({
        side: side,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset
    }));

    const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/get_best_order`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to cancel order: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

async function sendUpdateBestPriceTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        account: data['order']['account'],
        sqrtPrice: ethers.parseUnits(Math.sqrt(data['order']['price']).toString(), decimal),
        amount: ethers.parseUnits(data['order']['quantity'].toString(), decimal),
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_symbol_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_symbol_address_mapping[data['order']['quoteAsset']],
        quoteAmount: ethers.parseUnits((data['order']['price'] * data['order']['quantity']).toString(), decimal),
        isValid: data['order']['isValid'],
        timestamp: ethers.parseUnits(data['order']['timestamp'].toString(), decimal)
    }
    const proofOfTask = `UpdateBestPrice-${data['order']['side']}-${order.orderId}-${data['order']['timestamp']}`;
    const result = await dalService.sendUpdateBestPriceTask(proofOfTask, order, taskDefinitionId.UpdateBestPrice);
    return result;
}

async function sendCancelOrderTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_symbol_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_symbol_address_mapping[data['order']['quoteAsset']],
        timestamp: ethers.parseUnits(data['order']['timestamp'].toString(), decimal)
    }
    const proofOfTask = `CancelOrder-${data['order']['side']}-${order.orderId}-${data['order']['timestamp']}`;
    const result = await dalService.sendCancelOrderTask(proofOfTask, order, taskDefinitionId.CancelOrder);
    return result;
}

async function sendCreateOrderTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        account: data['order']['account'],
        sqrtPrice: ethers.parseUnits(Math.sqrt(data['order']['price']).toString(), decimal),
        amount: ethers.parseUnits(data['order']['quantity'].toString(), decimal),
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_symbol_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_symbol_address_mapping[data['order']['quoteAsset']],
        quoteAmount: ethers.parseUnits((data['order']['price'] * data['order']['quantity']).toString(), decimal),
        isValid: data['order']['isValid'],
        timestamp: ethers.parseUnits(data['order']['timestamp'].toString(), decimal)
    }
    const proofOfTask = `CreateOrder-${data['order']['side']}-${order.orderId}-${data['order']['timestamp']}`;
    const result = await dalService.sendCreateOrderTask(proofOfTask, order, taskDefinitionId.CreateOrder);
    return result;
}

async function sendFillOrderTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        account: data['order']['account'],
        sqrtPrice: ethers.parseUnits(Math.sqrt(data['order']['price']).toString(), decimal),
        amount: ethers.parseUnits(data['order']['quantity'].toString(), decimal),
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_symbol_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_symbol_address_mapping[data['order']['quoteAsset']],
        quoteAmount: ethers.parseUnits((data['order']['price'] * data['order']['quantity']).toString(), decimal),
        isValid: data['order']['isValid'],
        timestamp: ethers.parseUnits(data['order']['timestamp'].toString(), decimal)
    }
    const proofOfTask = `FillOrder-${data['order']['side']}-${order.orderId}-${data['order']['timestamp']}`;
    const result = await dalService.sendFillOrderTask(proofOfTask, order, taskDefinitionId.FillOrder);
    return result;
}

module.exports = {
    generateOrderBook,

    taskDefinitionId,
    
    // createOrder,
    sendCreateOrderTask,
    sendFillOrderTask,
    sendUpdateBestPriceTask,
    
    handleCancelOrder,
    sendCancelOrderTask,
    
    getBestOrder,

    decimal,
    token_symbol_address_mapping,
    token_address_symbol_mapping,
};
