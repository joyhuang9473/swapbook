import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:8080'; // or whatever the Execution Service URL is

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
  placeLimitOrder: async (account, price, quantity, side, baseAsset, quoteAsset) => {
    try {
      const response = await api.post('/limitOrder', {
        account,
        price,
        quantity,
        side,
        baseAsset,
        quoteAsset
      });
      return response.data;
    } catch (error) {
      console.error('Error placing limit order:', error);
      throw error;
    }
  },
  
  // Cancel an order
  cancelOrder: async (orderId, side, baseAsset, quoteAsset) => {
    try {
      const response = await api.post('/cancelOrder', {
        orderId,
        side,
        baseAsset,
        quoteAsset
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
      const response = await api.post('/orderBook', {
        symbol
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      throw error;
    }
  },

  // Initiate withdrawal (need to add this endpoint to the Execution Service)
  initiateWithdrawal: async (account, asset, amount) => {
    try {
      const response = await api.post('/initiateWithdrawal', {
        account,
        asset,
        amount
      });
      return response.data;
    } catch (error) {
      console.error('Error initiating withdrawal:', error);
      throw error;
    }
  }
};

export default api; 