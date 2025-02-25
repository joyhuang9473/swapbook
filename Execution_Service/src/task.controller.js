"use strict";
require("dotenv").config();
const dalService = require("./dal.service.js");
const { ethers } = require("ethers");

const taskDefinitionId = {
    UpdateBest: 0,
    FillOrder: 1,
    ProcessWithdrawal: 2,
}

const decimal = 18;

// TODO: hard code for now
const token_address_mapping = {
    'WBTC': '0x5390Ebc9713181856FDE1d6c897d78461b81e48a',
    'USDC': '0x35C7bBa8449fa24dC44f64fff8CD7750BE58a4eC',
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

    await dalService.sendTask(order.orderId.toString(), order, taskDefinitionId.UpdateBest);
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

module.exports = { generateOrderBook, createOrder };
