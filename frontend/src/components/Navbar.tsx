import React from 'react';
import { 
  Box, 
  Flex, 
  Button, 
  Heading, 
  HStack,
  Text,
  Spacer
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { customer, logout } = useAuth();

  return (
    <Box bg="gray.100" px={4} py={2}>
      <Flex 
        maxW="1200px" 
        mx="auto"
        align="center"
      >
        <HStack spacing={2}>
          <Heading size="md" mr={8}>AnyFormat</Heading>
          <Link to="/">
            <Button variant="ghost" size="sm">Overview</Button>
          </Link>
          <Link to="/integrations">
            <Button variant="ghost" size="sm">Integrations</Button>
          </Link>
          <Link to="/files">
            <Button variant="ghost" size="sm">Files</Button>
          </Link>
        </HStack>

        <Spacer />
        
        {customer && (
          <HStack spacing={4}>
            <Text fontSize="sm" color="gray.600">
              {customer.name}
            </Text>
            <Button 
              onClick={logout} 
              colorScheme="red" 
              variant="outline"
              size="sm"
            >
              Clear Customer
            </Button>
          </HStack>
        )}
      </Flex>
    </Box>
  );
};

export default Navbar; 