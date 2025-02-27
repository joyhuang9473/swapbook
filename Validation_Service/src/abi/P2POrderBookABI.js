const P2POrderBookABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_attestationCenterAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_poolManager",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "DirectWithdrawalDisabled",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EscrowBalanceMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientAllowance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidTaskDefinitionId",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnlyAttestationCenter",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OrderTooLarge",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TaskNotApproved",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnsuccessfulTransfer",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "taker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sqrtPrice",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "FillOrder",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account1",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "asset1",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount1",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "account2",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "asset2",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount2",
        "type": "uint256"
      }
    ],
    "name": "Swap",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "orderId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "maker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sqrtPrice",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "UpdateBestOrder",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "asset",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "WithdrawalProcessed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "ATTESTATION_CENTER",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "bestBidAndAsk",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "account",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "sqrtPrice",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isBid",
            "type": "bool"
          },
          {
            "internalType": "address",
            "name": "baseAsset",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "quoteAsset",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "quoteAmount",
            "type": "uint256"
          }
        ],
        "internalType": "struct Order",
        "name": "bid",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "account",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "sqrtPrice",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isBid",
            "type": "bool"
          },
          {
            "internalType": "address",
            "name": "baseAsset",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "quoteAsset",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "quoteAmount",
            "type": "uint256"
          }
        ],
        "internalType": "struct Order",
        "name": "ask",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "asset",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "escrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "escrowedFunds",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskDefinitionId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "taskData",
        "type": "bytes"
      }
    ],
    "name": "runTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "asset",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "type": "event",
    "name": "PartialFillOrder",
    "inputs": [
      {
        "name": "takerOrderId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "makerOrderId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CompleteFillOrder",
    "inputs": [
      {
        "name": "makerOrderId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "takerOrderId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
];

module.exports = P2POrderBookABI; 