"use strict";
require("dotenv").config();
const dalService = require("./dal.service.js");
const { ethers } = require("ethers");

const taskDefinitionId = {
    Origin: 0,
    // new task: start from 1
    UpdateBestPrice: 1,
    FillOrder: 2,
    ProcessWithdrawal: 3,
    CancelOrder: 4,
    CreateOrder: 5,
}

const decimal = 18;

const token_symbol_address_mapping = {
    'WETH': '0xB7DE8be39aA5f950C943a4129bD03B207A52e06a',
    'USDC': '0x62c6a8496dDa41FCdf7135726dE498f55EfF3bea',
}
const token_address_symbol_mapping = {
    '0xB7DE8be39aA5f950C943a4129bD03B207A52e06a': 'WETH',
    '0x62c6a8496dDa41FCdf7135726dE498f55EfF3bea': 'USDC',
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

    let data = await response.json();
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
        isValid: data['order']['isValid']
    }
    const result = await dalService.sendUpdateBestPriceTask(order.orderId.toString(), order, taskDefinitionId.UpdateBestPrice);
    return result;
}

async function sendCancelOrderTask(data) {
    const order = {
        orderId: data['order']['order_id'],
        isBid: data['order']['side'] === 'bid',
        baseAsset: token_symbol_address_mapping[data['order']['baseAsset']],
        quoteAsset: token_symbol_address_mapping[data['order']['quoteAsset']],
    }
    const result = await dalService.sendCancelOrderTask(order.orderId.toString(), order, taskDefinitionId.CancelOrder);
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
        isValid: data['order']['isValid']
    }
    const result = await dalService.sendCreateOrderTask(order.orderId.toString(), order, taskDefinitionId.CreateOrder);
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
        isValid: data['order']['isValid']
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
    sendUpdateBestPriceTask,
    
    cancelOrder,
    sendCancelOrderTask,
    
    getBestOrder,

    decimal,
    token_symbol_address_mapping,
    token_address_symbol_mapping,
};
