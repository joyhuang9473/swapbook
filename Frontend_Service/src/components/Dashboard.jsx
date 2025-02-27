import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  Button,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
  Select,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightAddon,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Alert,
  AlertIcon,
  Stack,
  Flex,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { useWeb3 } from '../context/Web3Context';
import { orderApi } from '../utils/api';
import { ethers } from 'ethers';
import { config } from '../../config';

// Use token definitions from config file
const TOKENS = config.tokens;

const Dashboard = () => {
  const { active, account, escrowFunds } = useWeb3();
  const toast = useToast();
  
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [userOrders, setUserOrders] = useState([]);
  const [filledOrders, setFilledOrders] = useState([]);
  const [selectedPair, setSelectedPair] = useState('WETH_USDC');
  
  // Form states
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [side, setSide] = useState('bid');
  
  // Escrow modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [tokenToEscrow, setTokenToEscrow] = useState(TOKENS.USDC);
  const [escrowAmount, setEscrowAmount] = useState('');
  
  // Parse the trading pair
  const getPairTokens = () => {
    const [baseAsset, quoteAsset] = selectedPair.split('_');
    return {
      baseAsset: TOKENS[baseAsset].address,
      quoteAsset: TOKENS[quoteAsset].address,
      baseSymbol: baseAsset,
      quoteSymbol: quoteAsset,
    };
  };
  
  // Load order book data
  const fetchOrderBook = async () => {
    if (!active) return;
    try {
      setIsLoading(true);
      const response = await orderApi.getOrderBook(selectedPair);
      const bids = response.bids
      const asks = response.asks

      setOrderBook( { bids: bids, asks: asks });
    } catch (error) {
      console.error('Error fetching order book:', error);
      toast({
        title: 'Error',
        description: 'Failed to load order book data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch user's open orders
  const fetchUserOrders = async () => {
    if (!active || !account) return;
    
    // In a real app, you'd call an API to get this data
    // For now, we'll filter the order book for the user's orders
    const openOrders = [
      ...(orderBook.bids || []).filter(order => order.account === account),
      ...(orderBook.asks || []).filter(order => order.account === account)
    ];
    
    setUserOrders(openOrders);
  };
  
  // Place a limit order
  const placeLimitOrder = async () => {
    if (!active || !account) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet first',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (!price || !quantity) {
      toast({
        title: 'Error',
        description: 'Please enter both price and quantity',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const { baseAsset, quoteAsset } = getPairTokens();
      
      const response = await orderApi.placeLimitOrder(
        account,
        parseFloat(price),
        parseFloat(quantity),
        side,
        baseAsset,
        quoteAsset
      );
      
      toast({
        title: 'Success',
        description: `${side === 'bid' ? 'Buy' : 'Sell'} order placed successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Refresh data
      fetchOrderBook();
      fetchUserOrders();
      
      // Clear form
      setPrice('');
      setQuantity('');
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: 'Error',
        description: 'Failed to place order. Make sure you have enough funds in escrow.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Cancel an order
  const cancelOrder = async (orderId, orderSide) => {
    if (!active || !account) return;
    
    try {
      setIsLoading(true);
      const { baseAsset, quoteAsset } = getPairTokens();
      
      await orderApi.cancelOrder(
        orderId,
        orderSide,
        baseAsset,
        quoteAsset
      );
      
      toast({
        title: 'Success',
        description: 'Order cancelled successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Refresh data
      fetchOrderBook();
      fetchUserOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel order',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle deposit to escrow
  const handleEscrowDeposit = async () => {
    if (!active || !account) return;
    
    if (!escrowAmount || parseFloat(escrowAmount) <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Convert amount to wei with the correct decimal places
      const amountInWei = ethers.utils.parseUnits(
        escrowAmount, 
        tokenToEscrow.decimals
      );

      await escrowFunds(tokenToEscrow.address, amountInWei);

      toast({
        title: 'Success',
        description: `${escrowAmount} ${tokenToEscrow.symbol} deposited to escrow`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      onClose();
      setEscrowAmount('');
    } catch (error) {
      console.error('Error depositing to escrow:', error);
      toast({
        title: 'Error',
        description: 'Failed to deposit to escrow. Check your token balance.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle withdrawal
  const initiateWithdrawal = async (token, amount) => {
    if (!active || !account) return;
    
    try {
      setIsLoading(true);
      
      await orderApi.initiateWithdrawal(
        account,
        token.address,
        ethers.utils.parseUnits(amount, token.decimals)
      );
      
      toast({
        title: 'Success',
        description: `Withdrawal initiated for ${amount} ${token.symbol}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error initiating withdrawal:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate withdrawal',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Refresh data when account or pair changes
  useEffect(() => {
    if (active) {
      fetchOrderBook();
      fetchUserOrders();
    }
  }, [active, account, selectedPair]);
  
  // Establish a polling interval to refresh data
  useEffect(() => {
    if (!active) return;
    
    const interval = setInterval(() => {
      fetchOrderBook();
      fetchUserOrders();
    }, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, [active, account, selectedPair]);
  
  if (!active) {
    return (
      <Box textAlign="center" py={10}>
        <Heading size="lg" mb={4}>Connect Your Wallet</Heading>
        <Text>Please connect your wallet to access SwapBook</Text>
      </Box>
    );
  }
  
  return (
    <Box>
      <Grid templateColumns="repeat(12, 1fr)" gap={6}>
        {/* Left Column - Order Book */}
        <GridItem colSpan={{ base: 12, md: 7 }}>
          <Card mb={6}>
            <CardHeader>
              <Flex justify="space-between" align="center">
                <Heading size="md">Order Book</Heading>
                <Select 
                  value={selectedPair} 
                  onChange={(e) => setSelectedPair(e.target.value)}
                  width="150px"
                >
                  <option value="WETH/USDC">WETH/USDC</option>
                </Select>
              </Flex>
            </CardHeader>
            <CardBody>
              {isLoading ? (
                <Flex justify="center" p={4}>
                  <Spinner />
                </Flex>
              ) : (
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  {/* Asks (Sell Orders) */}
                  <GridItem>
                    <Text fontWeight="bold" mb={2} color="red.400">Asks (Sell)</Text>
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Price</Th>
                          <Th isNumeric>Amount</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {orderBook.asks && orderBook.asks.length > 0 ? (
                          orderBook.asks.map((order, idx) => (
                            <Tr key={`ask-${idx}`}>
                              <Td color="red.400">{order.price}</Td>
                              <Td isNumeric>{order.amount}</Td>
                            </Tr>
                          ))
                        ) : (
                          <Tr>
                            <Td colSpan={2} textAlign="center">No ask orders</Td>
                          </Tr>
                        )}
                      </Tbody>
                    </Table>
                  </GridItem>
                  
                  {/* Bids (Buy Orders) */}
                  <GridItem>
                    <Text fontWeight="bold" mb={2} color="green.400">Bids (Buy)</Text>
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Price</Th>
                          <Th isNumeric>Amount</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {orderBook.bids && orderBook.bids.length > 0 ? (
                          orderBook.bids.map((order, idx) => (
                            <Tr key={`bid-${idx}`}>
                              <Td color="green.400">{order.price}</Td>
                              <Td isNumeric>{order.amount}</Td>
                            </Tr>
                          ))
                        ) : (
                          <Tr>
                            <Td colSpan={2} textAlign="center">No bid orders</Td>
                          </Tr>
                        )}
                      </Tbody>
                    </Table>
                  </GridItem>
                </Grid>
              )}
            </CardBody>
          </Card>
          
          {/* User's Orders and History */}
          <Card>
            <CardHeader>
              <Heading size="md">Your Orders</Heading>
            </CardHeader>
            <CardBody>
              <Tabs colorScheme="brand">
                <TabList>
                  <Tab>Open Orders</Tab>
                  <Tab>Filled Orders</Tab>
                </TabList>
                <TabPanels>
                  {/* Open Orders Tab */}
                  <TabPanel>
                    {userOrders.length > 0 ? (
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Type</Th>
                            <Th>Price</Th>
                            <Th>Amount</Th>
                            <Th>Action</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {userOrders.map((order, idx) => (
                            <Tr key={`order-${idx}`}>
                              <Td>
                                <Badge colorScheme={order.isBid ? "green" : "red"}>
                                  {order.isBid ? "Buy" : "Sell"}
                                </Badge>
                              </Td>
                              <Td>{order.price}</Td>
                              <Td>{order.amount}</Td>
                              <Td>
                                <Button 
                                  size="xs" 
                                  colorScheme="red" 
                                  onClick={() => cancelOrder(order.orderId, order.isBid ? 'bid' : 'ask')}
                                  isLoading={isLoading}
                                >
                                  Cancel
                                </Button>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    ) : (
                      <Text textAlign="center" py={4}>You have no open orders</Text>
                    )}
                  </TabPanel>
                  
                  {/* Filled Orders Tab */}
                  <TabPanel>
                    {filledOrders.length > 0 ? (
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Type</Th>
                            <Th>Price</Th>
                            <Th>Amount</Th>
                            <Th>Time</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {filledOrders.map((order, idx) => (
                            <Tr key={`filled-${idx}`}>
                              <Td>
                                <Badge colorScheme={order.isBid ? "green" : "red"}>
                                  {order.isBid ? "Buy" : "Sell"}
                                </Badge>
                              </Td>
                              <Td>{order.price}</Td>
                              <Td>{order.amount}</Td>
                              <Td>{new Date(order.timestamp).toLocaleString()}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    ) : (
                      <Text textAlign="center" py={4}>You have no filled orders</Text>
                    )}
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>
        </GridItem>
        
        {/* Right Column - Forms */}
        <GridItem colSpan={{ base: 12, md: 5 }}>
          {/* Place Order Form */}
          <Card mb={6}>
            <CardHeader>
              <Heading size="md">Place Limit Order</Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <Select 
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  colorScheme={side === 'bid' ? 'green' : 'red'}
                >
                  <option value="bid">Buy</option>
                  <option value="ask">Sell</option>
                </Select>
                
                <FormControl>
                  <FormLabel>Price</FormLabel>
                  <InputGroup>
                    <Input 
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      type="number"
                      placeholder="0.00"
                    />
                    <InputRightAddon children={getPairTokens().quoteSymbol} />
                  </InputGroup>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Amount</FormLabel>
                  <InputGroup>
                    <Input 
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      type="number"
                      placeholder="0.00"
                    />
                    <InputRightAddon children={getPairTokens().baseSymbol} />
                  </InputGroup>
                </FormControl>
                
                <Button 
                  colorScheme={side === 'bid' ? 'green' : 'red'} 
                  onClick={placeLimitOrder}
                  isLoading={isLoading}
                  width="full"
                >
                  {side === 'bid' ? 'Buy' : 'Sell'} {getPairTokens().baseSymbol}
                </Button>
              </Stack>
            </CardBody>
          </Card>
          
          {/* Escrow and Withdraw */}
          <Card>
            <CardHeader>
              <Heading size="md">Escrow Management</Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <Alert status="info">
                  <AlertIcon />
                  <Text fontSize="sm">
                    You need to deposit funds into escrow before trading. Escrow funds are held securely in the smart contract.
                  </Text>
                </Alert>
                
                <Button 
                  colorScheme="brand" 
                  onClick={onOpen}
                  width="full"
                >
                  Deposit to Escrow
                </Button>
                
                <Divider />
                
                <Heading size="sm">Withdraw Funds</Heading>
                <Text fontSize="sm">
                  Withdrawals must be initiated through the Execution Service.
                </Text>
                
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <GridItem>
                    <Button 
                      onClick={() => initiateWithdrawal(TOKENS.WETH, '0.1')}
                      isLoading={isLoading}
                      width="full"
                    >
                      Withdraw WETH
                    </Button>
                  </GridItem>
                  <GridItem>
                    <Button 
                      onClick={() => initiateWithdrawal(TOKENS.USDC, '100')}
                      isLoading={isLoading}
                      width="full"
                    >
                      Withdraw USDC
                    </Button>
                  </GridItem>
                </Grid>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
      
      {/* Escrow Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Deposit to Escrow</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text>
                Funds in escrow are used to fulfill your orders. You need to approve the contract to spend your tokens before depositing.
              </Text>
              
              <FormControl>
                <FormLabel>Token</FormLabel>
                <Select 
                  value={tokenToEscrow.symbol}
                  onChange={(e) => setTokenToEscrow(TOKENS[e.target.value])}
                >
                  <option value="WETH">WETH</option>
                  <option value="USDC">USDC</option>
                </Select>
              </FormControl>
              
              <FormControl>
                <FormLabel>Amount</FormLabel>
                <InputGroup>
                  <Input 
                    value={escrowAmount}
                    onChange={(e) => setEscrowAmount(e.target.value)}
                    type="number"
                    placeholder="0.00"
                  />
                  <InputRightAddon children={tokenToEscrow.symbol} />
                </InputGroup>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="brand" 
              onClick={handleEscrowDeposit}
              isLoading={isLoading}
            >
              Deposit
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Dashboard; 