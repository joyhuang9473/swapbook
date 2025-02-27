# P2P Orderbook AVS Smart Contracts

This directory contains the smart contracts that power the P2P Orderbook AVS system.

## Key Contracts

- **P2POrderBookAvsHook.sol**: Main contract that integrates with Uniswap V4 Hooks and handles order settlement
- **DynamicFeesAvsHook.sol**: Contract for dynamic fee calculation (to be used in future integration)

## Overview

The P2POrderBookAvsHook contract serves as the on-chain component of our decentralized orderbook system. It:

1. Manages escrowed funds for users
2. Tracks the best bid and ask prices for each token pair
3. Executes fills and settlements based on off-chain matching
4. Integrates with Uniswap V4 via hooks to improve swap execution

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Setup

1. Install dependencies:
   ```shell
   forge install
   ```

2. Create a `.env` file with:
   ```
   PRIVATE_KEY=your_deployer_private_key
   L2_RPC=your_l2_rpc_url
   L2_CHAIN=network_id
   L2_ETHERSCAN_API_KEY=your_etherscan_api_key
   L2_VERIFIER_URL=verification_url
   ATTESTATION_CENTER_ADDRESS=address_of_attestation_center
   POOL_MANAGER_ADDRESS=address_of_uniswap_v4_pool_manager
   ```

## Deployment

Deploy the P2POrderBookAvsHook contract:

```shell
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

## Testing

Run tests with:

```shell
forge test
```

## Foundry Commands

### Build

```shell
forge build
```

### Format

```shell
forge fmt
```

### Gas Snapshots

```shell
forge snapshot
```

### Help

```shell
forge --help
```
