import React, { useState } from 'react';
import { 
  Box, 
  VStack, 
  Heading, 
  Input, 
  Button, 
  Text,
  Container,
  Link as ChakraLink
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const Overview = () => {
  const [customerName, setCustomerName] = useState('');
  const { customer, login } = useAuth();

  // Generate a random ID for demo purposes
  const customerId = 'dc44352b-cd37-467d-b1b1-0e6a0296f5f3';

  const handleSetCustomer = () => {
    if (customerName) {
      login(customerId, customerName);
    }
  };

  return (
    <Container maxW="container.lg" pt={8}>
      <VStack align="stretch" spacing={6}>
        <Heading size="xl">AnyFormat Integrations Demo</Heading>
        
        <Text color="gray.600">
          This mini-app demonstrates a minimal version of your integration use case end to end.
        </Text>

        <Box>
          <Text>
            Go to <ChakraLink as={Link} to="/integrations" color="blue.500">Integrations</ChakraLink> to manage integrations.
          </Text>
          <Text>
            Go to <ChakraLink as={Link} to="/files" color="blue.500">Files</ChakraLink> to browse files and download them.
          </Text>
        </Box>

        <Box bg="gray.50" p={6} borderRadius="md">
          <VStack align="stretch" spacing={4}>
            <Heading size="md">Test User</Heading>
            
            <Text color="gray.600" fontSize="sm">
              This user id and name will be used to connect external apps and run integrations.
            </Text>

            <Box>
              <Text fontSize="sm" mb={1}>User ID: {customerId}</Text>
              <Text fontSize="sm" mb={3}>Name: {customer?.name || 'Not set'}</Text>
              
              <Box display="flex" gap={3}>
                <Input
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  size="md"
                  maxW="300px"
                  bg="white"
                />
                <Button 
                  onClick={handleSetCustomer} 
                  colorScheme="blue"
                  isDisabled={!customerName}
                >
                  Update Name
                </Button>
              </Box>
            </Box>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default Overview; 