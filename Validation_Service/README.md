# Validation Service

This service validates tasks executed by the Execution Service within the AVS (Actively Validated Service) framework.

## Overview

The Validation Service plays a crucial role in the P2P orderbook system by:
- Validating proposed tasks from the Execution Service
- Verifying the correctness of operations before they're finalized on-chain
- Ensuring consistency between on-chain and off-chain state
- Supporting the AVS attestation framework

## Key Functions

The service validates different types of tasks:
- **CreateOrder validation**: Verifies order creation operations
- **CancelOrder validation**: Validates order cancellation requests
- **FillOrder validation**: Confirms order filling/matching operations
- **UpdateBestPrice validation**: Verifies best price updates
- **ProcessWithdrawal validation**: Validates withdrawal requests

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
ORDERBOOK_SERVICE_ADDRESS=http://orderbook-service-address:8000
```

### Running Locally

```bash
node index.js
```

### Docker

Build and run the Docker container:

```bash
docker build -t validation-service .
docker run -p 8080:8080 validation-service
```

## API Endpoints

The service exposes validation endpoints corresponding to the different AVS tasks:

- **POST /validate**: Main validation endpoint used by attester nodes

## Integration

This service integrates with:
- AVS Attester nodes - for task validation
- Orderbook Service - for verifying orderbook state
- Smart Contracts - for checking on-chain state 