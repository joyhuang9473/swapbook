# P2P Orderbook Exchange Frontend

A modern React frontend for the P2P Orderbook Exchange using Uniswap V4 Hooks.

## Features

- Connect to MetaMask wallet on Polygon Amoy testnet
- View the order book with bids and asks
- Place and cancel limit orders
- Deposit funds to escrow
- Initiate withdrawals
- View your open and filled orders

## Technology Stack

- React with Vite for fast builds
- Chakra UI for modern, responsive components
- ethers.js for Ethereum interaction
- Web3-React for wallet connection
- React Router for navigation

## Prerequisites

- Node.js (v16 or higher)
- Yarn or npm
- MetaMask with Polygon Amoy configured

## Getting Started

1. Clone the repository:

```bash
git clone <repo-url>
cd uniswap-v4-hook-avs-ours/Frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Configuration

Update the following values in `src/context/Web3Context.jsx` with your contract addresses:

```javascript
const CHAIN_ID = 80002; // Polygon Amoy testnet
const P2P_ORDERBOOK_ADDRESS = '0x0000000000000000000000000000000000000000'; // Replace with actual address
```

Also update the token addresses in `src/components/Dashboard.jsx` if needed.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Adding Additional Trading Pairs

To add more trading pairs:

1. Update the `TOKENS` constant in `src/components/Dashboard.jsx`
2. Add the new pair option in the select dropdown in the Dashboard component

## License

MIT 