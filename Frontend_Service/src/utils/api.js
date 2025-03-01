import axios from 'axios';
import config from '../../config.js';

const API_URL = process.env.NODE_ENV === 'production' 
  ? config.api.baseUrl.production
  : config.api.baseUrl.development;

// Create an axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// API functions for order operations
export const orderApi = {
  // Place a limit order
  placeLimitOrder: async (account, price, quantity, side, baseAsset, quoteAsset, signature) => {
    try {
      const response = await api.post(config.api.endpoints.limitOrder, {
        account,
        price,
        quantity,
        side,
        baseAsset,
        quoteAsset,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('Error placing limit order:', error);
      throw error;
    }
  },
  
  // Cancel an order
  cancelOrder: async (orderId, signature) => {
    try {
      const response = await api.post(config.api.endpoints.cancelOrder, {
        orderId,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  },
  
  // Get orderbook for a symbol
  getOrderBook: async (symbol) => {
    try {
      const formData = new FormData();
      formData.append('payload', JSON.stringify({ symbol }));
      
      const response = await api.post(config.api.endpoints.orderBook, { symbol }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      throw error;
    }
  },

  // Initiate withdrawal (need to add this endpoint to the Execution Service)
  initiateWithdrawal: async (account, asset, signature) => {
    try {
      const response = await api.post(config.api.endpoints.initiateWithdrawal, {
        account,
        asset,
        signature
      });
      return response.data;
    } catch (error) {
      // show the error message
      console.error('Error initiating withdrawal:', error.response.data.message);

      throw error;
    }
  }
};

export default api; 