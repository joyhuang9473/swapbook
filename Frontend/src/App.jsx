import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, useToast } from '@chakra-ui/react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import { useWeb3 } from './context/Web3Context';

const App = () => {
  const { active, networkError } = useWeb3();
  const toast = useToast();

  // Show network error as toast
  useEffect(() => {
    if (networkError) {
      toast({
        title: 'Network Error',
        description: networkError,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    }
  }, [networkError, toast]);

  return (
    <Layout>
      <Routes>
        <Route 
          path="/" 
          element={<Dashboard />} 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default App; 