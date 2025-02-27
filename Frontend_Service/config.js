import defaultConfig from './config.default.json';

export const config = {
  ...defaultConfig,
  tokens: {
    WETH: {
      address: import.meta.env.WETH_ADDRESS || defaultConfig.tokens.WETH.address,
      symbol: "WETH",
      decimals: 18
    },
    USDC: {
      address: import.meta.env.USDC_ADDRESS || defaultConfig.tokens.USDC.address,
      symbol: "USDC",
      decimals: 6
    }
  },
  contracts: {
    P2P_ORDERBOOK_ADDRESS: import.meta.env.P2P_ORDERBOOK_ADDRESS || defaultConfig.contracts.P2P_ORDERBOOK_ADDRESS
  },
  api: {
    baseUrl: {
      development: import.meta.env.EXECUTION_SERVICE_ADDRESS || defaultConfig.api.baseUrl.development,
      production: import.meta.env.EXECUTION_SERVICE_ADDRESS || defaultConfig.api.baseUrl.production
    },
    endpoints: {
      limitOrder: "/limitOrder",
      cancelOrder: "/cancelOrder",
      orderBook: "/api/orderbook",
      initiateWithdrawal: "/initiateWithdrawal"
    }
  }
};

export default config;