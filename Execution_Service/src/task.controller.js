"use strict";
const dalService = require("./dal.service.js");

const taskDefinitionId = {
    UpdateBest: 0,
    FillOrder: 1,
    ProcessWithdrawal: 2,
}



// struct Order {
//     uint256 orderId;
//     address account;
//     uint256 sqrtPrice; // sqrt price used because it's cheaper to store (noteredundant as we have quote asset amount)
//     uint256 amount; // base asset amount
//     bool isBid; // bid is buying, ask is selling
//     address baseAsset; // WETH in WETH/USDC
//     address quoteAsset; // USDC in WETH/USDC
//     uint256 quoteAmount; // quote asset amount (alternative representation of price, better for swapping)
// }
// await dalService.sendTask(cid, data, 0);

async function createOrder(symbol, side, quantity, price) {
    // Create form data
    const formData = new FormData();
    formData.append('payload', JSON.stringify({
        symbol: symbol,
        side: side,
        quantity: Number(quantity),
        price: Number(price)
    }));

    const response = await fetch(`http://0.0.0.0:8000/api/register_order`, {
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

async function generateOrderBook(symbol) {
    // Create form data
    const formData = new FormData();
    formData.append('payload', JSON.stringify({
        symbol: symbol,
    }));

    const response = await fetch(`http://0.0.0.0:8000/api/orderbook`, {
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
