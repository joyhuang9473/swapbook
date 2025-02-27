# Orderbook Service

This service maintains the orderbook state and implements the matching engine for the P2P trading system.

## Overview

The Orderbook Service is responsible for:
- Maintaining the current state of all order books
- Processing order placements, cancellations, and executions
- Matching orders when possible
- Providing order book data to other services

## API Endpoints

- **POST /api/register_order**: Register a new order in the orderbook
- **POST /api/cancel_order**: Cancel an existing order
- **POST /api/order**: Get details about a specific order
- **POST /api/orderbook**: Get the current state of an orderbook for a specific token pair
- **POST /api/get_best_order**: Get the best order (highest bid or lowest ask) for a token pair
- **POST /api/check_available_funds**: Check available funds for a specific user

## Setup

### Prerequisites
- Python (3.8+)
- FastAPI

### Installation

```bash
pip install -r requirements.txt
```

### Running Locally

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Docker

Build and run the Docker container:

```bash
docker build -t orderbook-service .
docker run -p 8000:8000 orderbook-service
```

## Integration

This service is designed to work with:
- Execution Service - to process new orders
- Validation Service - to validate order operations
- Smart Contracts - for on-chain settlement 