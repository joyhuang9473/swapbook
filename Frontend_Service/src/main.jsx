import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { BrowserRouter } from 'react-router-dom';
import { Web3ReactProvider } from '@web3-react/core';
import App from './App';
import { Web3Provider, metaMask, metaMaskHooks } from './context/Web3Context';

// Extend the theme for a dark mode and custom colors
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: '#f5f0ff',
      100: '#e9dbff',
      200: '#d4b6ff',
      300: '#b988ff',
      400: '#9f5aff',
      500: '#882bff',
      600: '#7622e6',
      700: '#5f18c0',
      800: '#461498',
      900: '#2e0c70',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'white',
      },
    },
  },
});

// Define the connectors for Web3ReactProvider
const connectors = [[metaMask, metaMaskHooks]];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ChakraProvider theme={theme}>
        <Web3ReactProvider connectors={connectors}>
          <Web3Provider>
            <App />
          </Web3Provider>
        </Web3ReactProvider>
      </ChakraProvider>
    </BrowserRouter>
  </React.StrictMode>
); 