"use strict";
require("dotenv").config();
const dalService = require("./dal.service.js");
const { ethers } = require("ethers");

const taskDefinitionId = {
    UpdateBest: 0,
    FillOrder: 1,
    ProcessWithdrawal: 2,

    // internal task: start from 10000
    INTERNAL_CancelOrder: 10000,
    INTERNAL_CreateOrder: 10001,
}

const decimal = 18;

// TODO: hard code for now
const token_address_mapping = {
    'WBTC': '0x832fbBCB6B4F4F6F97A05898B735edc4Fc6BF618',
    'USDC': '0xD834AEE46DDc4c7bBa4126396d0395B87B05c60c',
}

async function createOrder(account, price, quantity, side, baseAsset, quoteAsset) {
    // Create form data
    const formData = new FormData();
    formData.append('payload', JSON.stringify({
        account: account,
        price: Number(price),
        quantity: Number(quantity),
        side: side,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset
    }));

    const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/register_order`, {
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

async function cancelOrder(orderId, side, baseAsset, quoteAsset) {
    // Create form data
    const formData = new FormData();
    formData.append('payload', JSON.stringify({
        orderId: orderId,
        side: side,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset
    }));

    const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/cancel_order`, {
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

async function sendUpdateBestTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        account: data['order']['account'],
        sqrtPrice: ethers.parseUnits(Math.sqrt(data['order']['price']).toString(), decimal),
        amount: ethers.parseUnits(data['order']['quantity'].toString(), decimal),
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_address_mapping[data['order']['quoteAsset']],
        quoteAmount: ethers.parseUnits((data['order']['price'] * data['order']['quantity']).toString(), decimal)
    }
    const result = await dalService.sendUpdateBestTask(order.orderId.toString(), order, taskDefinitionId.UpdateBest);
    return result;
}

async function sendCancelOrderTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_address_mapping[data['order']['quoteAsset']],
    }
    const result = await dalService.sendCancelOrderTask(order.orderId.toString(), order, taskDefinitionId.INTERNAL_CancelOrder);
    return result;
}

async function sendCreateOrderTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        account: data['order']['account'],
        sqrtPrice: ethers.parseUnits(Math.sqrt(data['order']['price']).toString(), decimal),
        amount: ethers.parseUnits(data['order']['quantity'].toString(), decimal),
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_address_mapping[data['order']['quoteAsset']],
        quoteAmount: ethers.parseUnits((data['order']['price'] * data['order']['quantity']).toString(), decimal)
    }
    const result = await dalService.sendCreateOrderTask(order.orderId.toString(), order, taskDefinitionId.INTERNAL_CreateOrder);
    return result;
}

async function sendFillOrderTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        account: data['order']['account'],
        sqrtPrice: ethers.parseUnits(Math.sqrt(data['order']['price']).toString(), decimal),
        amount: ethers.parseUnits(data['order']['quantity'].toString(), decimal),
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_address_mapping[data['order']['quoteAsset']],
        quoteAmount: ethers.parseUnits((data['order']['price'] * data['order']['quantity']).toString(), decimal)
    }
    const result = await dalService.sendFillOrderTask(order.orderId.toString(), order, taskDefinitionId.FillOrder);
    return result;
}

module.exports = {
    generateOrderBook,

    taskDefinitionId,
    
    createOrder,
    sendCreateOrderTask,
    sendFillOrderTask,
    sendUpdateBestTask,
    
    cancelOrder,
    sendCancelOrderTask,
    
    getBestOrder,
};
