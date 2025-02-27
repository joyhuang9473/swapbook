# Execution Service

This service handles order execution requests, verifies signatures, and initiates tasks within the AVS framework.

## Overview

The Execution Service is a critical component of the P2P orderbook system, acting as the gateway between users and the AVS infrastructure. It:

- Verifies user signatures for order operations
- Validates order operations against the orderbook and on-chain state
- Initiates task execution within the AVS framework
- Communicates with the Orderbook Service to process orders

## Key Functions

- **CreateOrder**: Initiates the creation of a new order
- **CancelOrder**: Processes order cancellation requests
- **FillOrder**: Handles order filling (partial or complete, matching and execution)
- **UpdateBestPrice**: Updates the best price in the orderbook
- **ProcessWithdrawal**: Handles withdrawal requests

## Setup

### Prerequisites
- Node.js (>= v22.6.0)
- Yarn or npm

### Installation

```bash
# Install dependencies
yarn install
# or
npm install
```

### Configuration

Create a `.env` file with the following variables:
```
PRIVATE_KEY=your_private_key
ORDERBOOK_SERVICE_ADDRESS=http://orderbook-service-address:8000
OTHENTIC_CLIENT_RPC_ADDRESS=http://avs-aggregator-address:8545
```

### Running Locally

```bash
node index.js
```

### Docker

Build and run the Docker container:

```bash
docker build -t execution-service .
docker run -p 4003:4003 execution-service
```

## API Endpoints

The service exposes several endpoints for different order operations:

- **POST /create-order**: Create a new order
- **POST /cancel-order**: Cancel an existing order
- **POST /fill-order**: Fill/execute an order
- **POST /withdraw**: Process a withdrawal

Each endpoint expects properly signed payloads with order details.

## Integration

This service integrates with:
- Orderbook Service - for order processing
- AVS Infrastructure - for task execution
- Smart Contracts - for checking on-chain state 