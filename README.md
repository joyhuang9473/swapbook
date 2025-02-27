# Uniswap V4 Hook AVS P2P Orderbook

A decentralized peer-to-peer orderbook system built with EigenLayer's AVS (Actively Validated Service) and future Uniswap V4 Hook integration, enabling better execution prices by routing trades between the orderbook and AMMs.

## Overview

This project implements a decentralized orderbook system that processes orders off-chain while settling trades on-chain. It leverages EigenLayer's AVS infrastructure for secure off-chain computation and will integrate with Uniswap V4 Hooks to offer improved trading between the orderbook and AMMs.

Key features:
- **Decentralized Orderbook**: Maintains order books for token pairs
- **Off-chain Computation**: Processes orders through an AVS network
- **On-chain Settlement**: Securely settles trades on-chain
- **Future Uniswap V4 Hook Integration**: Will route AMM swaps to the orderbook when better prices are available

### Task Definitions

The system defines the following task types:
- **UpdateBestPrice (1)**: Updates the best price in the orderbook
- **FillOrder (2)**: Fills an order
- **ProcessWithdrawal (3)**: Processes a withdrawal request
- **CancelOrder (4)**: Cancels an existing order
- **CreateOrder (5)**: Creates a new order

## Architecture

The system consists of several interconnected services:

1. **Orderbook Service**: Maintains the order book state, matching engine, and order processing logic
2. **Execution Service**: Verifies user signatures, validates actions, and triggers AVS tasks
3. **Validation Service**: Validates task execution from the Execution Service
4. **Smart Contracts**: Handles on-chain settlement and fund management
5. **Frontend Service**: User interface for interacting with the system
6. **AVS Infrastructure**: EigenLayer's infrastructure for secure off-chain computation (Aggregator and Attesters)

When a user places an order:
1. The request is sent to the Execution Service
2. The Execution Service verifies the signature and order validity
3. The Execution Service submits the order to the Orderbook Service
4. The Execution Service triggers a task in the AVS
5. Attester nodes validate the task through the Validation Service
6. Valid tasks are executed on-chain through the smart contract

## Prerequisites

- Node.js (v 22.6.0 or later)
- Docker and Docker Compose
- Foundry (for smart contract development)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/uniswap-v4-hook-avs-ours.git
   cd uniswap-v4-hook-avs-ours
   ```

2. Install dependencies:
   ```bash
   # Install Othentic CLI (for AVS)
   npm i -g @othentic/othentic-cli
   ```

3. Create a `.env` file in the root directory using `.env.example` as a template:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your specific configuration values:
   - Private keys for operators
   - RPC URLs
   - Contract addresses
   - Other required parameters

## Smart Contract Deployment

Deploy the P2POrderBookAvsHook contract (if not already deployed):

```bash
cd contracts/
forge install
forge script script/P2POrderBookAvsHookDeploy.s.sol:P2POrderBookAvsHookDeploy \
 --rpc-url $L2_RPC \
 --private-key $PRIVATE_KEY \
 --broadcast -vvvv \
 --verify \
 --etherscan-api-key $L2_ETHERSCAN_API_KEY \
 --chain $L2_CHAIN \
 --verifier-url $L2_VERIFIER_URL \
 --sig="run(address,address)" \
 $ATTESTATION_CENTER_ADDRESS $POOL_MANAGER_ADDRESS
```

## Running the System

Start all services using Docker Compose:

```bash
docker-compose up --build
```

This will launch:
- Orderbook Service
- Execution Service
- Validation Service
- Frontend Service
- AVS Infrastructure (Aggregator and Attesters)
- Monitoring tools (Prometheus and Grafana)

## Usage

1. Access the frontend at `http://localhost:8080`
2. Connect your wallet
3. Place, cancel or fill orders through the interface

## Development

For development information, see each service's README for specific instructions:
- [Execution Service](./Execution_Service/README.md)
- [Validation Service](./Validation_Service/README.md)
- [Orderbook Service](./Orderbook_Service/README.md)
- [Frontend Service](./Frontend_Service/README.md)
- [Smart Contracts](./contracts/README.md)

## Monitoring

The system includes Prometheus and Grafana for monitoring:
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (default credentials: admin/admin)

## License

[MIT License](LICENSE)

