# Frontend Service

This service provides a web interface for users to interact with the P2P orderbook system.

## Overview

The Frontend Service provides a user-friendly interface for:
- Viewing current orderbooks for different trading pairs
- Placing buy and sell orders
- Canceling existing orders
- Viewing trading history
- Managing user balances and withdrawals

## Features

- **Real-time Orderbook Display**: View current bids and asks
- **Order Placement**: Place buy and sell orders with custom price and quantity
- **Order Management**: View and cancel existing orders
- **Fund Management**: Deposit and withdraw funds
- **Wallet Integration**: Connect with web3 wallets for transactions

## Setup

### Prerequisites
- Node.js v18+ 
- Yarn or npm

### Installation

```bash
# Install dependencies
yarn install
# or
npm install
```

### Configuration

Create/modify the `config.js` file with the following variables:
```js
{
  "WETH_ADDRESS": "0x138d34d08bc9Ee1f4680f45eCFb8fc8e4b0ca018",
  "USDC_ADDRESS": "0x8b2f38De30098bA09d69bd080A3814F4aE536A22",
  "P2P_ORDERBOOK_ADDRESS": "0x...",
  "EXECUTION_SERVICE_ADDRESS": "http://execution-service-address:4003"
}
```

### Running Locally

```bash
yarn dev
# or
npm run dev
```

### Docker

Build and run the Docker container:

```bash
docker build -t frontend-service .
docker run -p 8080:8080 frontend-service
```

## Access

Once running, access the frontend at:

```
http://localhost:8080
```

## Integration

This service integrates with:
- Execution Service - for submitting orders and operations
- Smart Contracts - for on-chain interactions (via web3 providers) 