import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { IntegrationAppProvider } from '@integration-app/react';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Overview from './pages/Overview';
import Integrations from './pages/Integrations';
import Files from './pages/Files';
import axios from 'axios';
import Cookies from 'js-cookie';

const App = () => {
  const fetchToken = async (): Promise<string> => {
    try {
      const customer = JSON.parse(Cookies.get('customer') || '{}');
      const response = await axios.post('http://localhost:5000/api/generate-token', {
        customerId: customer.id || '1234567',
        customerName: customer.name || 'Demo User',
      });
      return response.data.token;
    } catch (error) {
      console.error('Error fetching token:', error);
      throw error;
    }
  };

  return (
    <ChakraProvider>
      <AuthProvider>
        <IntegrationAppProvider fetchToken={fetchToken}>
          <BrowserRouter>
            <Navbar />
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/files" element={<Files />} />
            </Routes>
          </BrowserRouter>
        </IntegrationAppProvider>
      </AuthProvider>
    </ChakraProvider>
  );
};

export default App; 