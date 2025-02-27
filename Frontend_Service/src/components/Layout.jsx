import React from 'react';
import { 
  Box, 
  Flex, 
  Heading, 
  Spacer, 
  Button, 
  useColorMode,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
} from '@chakra-ui/react';
import { useWeb3 } from '../context/Web3Context';

const Layout = ({ children }) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { 
    connectWallet, 
    disconnectWallet, 
    account, 
    active, 
    loading,
    networkError
  } = useWeb3();

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleSwitchAccount = async () => {
    try {
      // First disconnect current wallet
      await disconnectWallet();
      
      // Request MetaMask to show account selection
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      
      // MetaMask will automatically trigger a connection with the new account
      // Your Web3Context should handle this via the 'accountsChanged' event
    } catch (error) {
      console.error('Failed to switch account:', error);
    }
  };

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      {/* Header */}
      <Flex 
        as="header" 
        bg="gray.800" 
        color="white" 
        p={4} 
        shadow="md"
        alignItems="center"
      >
        <Heading size="md">SwapBook</Heading>
        <Spacer />
        
        {networkError && (
          <Text color="red.300" mr={4}>
            {networkError}
          </Text>
        )}
        
        {active ? (
          <Menu>
            <MenuButton 
              as={Button} 
              colorScheme="brand"
              mr={4}
            >
              {formatAddress(account)}
            </MenuButton>
            <MenuList>
              <MenuItem onClick={disconnectWallet}>Disconnect</MenuItem>
              <MenuItem onClick={handleSwitchAccount}>Switch Account</MenuItem>
            </MenuList>
          </Menu>
        ) : (
          <Button 
            colorScheme="brand" 
            onClick={connectWallet} 
            isLoading={loading}
            mr={4}
          >
            Connect Wallet
          </Button>
        )}
      </Flex>

      {/* Main Content */}
      <Box flex="1" p={6}>
        {children}
      </Box>

      {/* Footer */}
      <Box as="footer" p={4} bg="gray.800" color="gray.400" textAlign="center">
        <Text fontSize="sm">© 2024 SwapBook - Powered by Othentic & Uniswap V4</Text>
      </Box>
    </Box>
  );
};

export default Layout; 