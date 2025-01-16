import React from 'react';
import { 
  Box, 
  Heading, 
  VStack,
  HStack,
  Button,
  Container,
  Text,
  Image,
  Flex
} from '@chakra-ui/react';
import { useIntegrationApp } from '@integration-app/react';

interface Connection {
  isDeactivated: boolean;
  disconnected: boolean;
  id: string;
}

interface Integration {
  key: string;
  name: string;
  logoUri?: string;
  state: 'READY' | 'CONFIGURATION_ERROR' | string;
  errors: Array<{ message: string; type: string }>;
  connection?: Connection;
}

const IntegrationItem = ({ integration }: { integration: Integration }) => {
  const integrationApp = useIntegrationApp();

  const handleConfigure = async () => {
    try {
      await integrationApp.integration(integration.key).open();
    } catch (error) {
      console.error('Error configuring integration:', error);
    }
  };

  const isError = integration.state === 'CONFIGURATION_ERROR';
  const isConnected = integration.connection && 
    !integration.connection.isDeactivated && 
    !integration.connection.disconnected;

  return (
    <Flex
      justify="space-between"
      align="center"
      p={4}
      borderWidth="1px"
      borderRadius="md"
      borderColor={isError ? "red.200" : isConnected ? "green.200" : "gray.200"}
      _hover={{
        boxShadow: 'md',
        borderColor: isError ? "red.300" : isConnected ? "green.300" : "gray.300",
        bg: 'gray.50'
      }}
      transition="all 0.2s"
    >
      <HStack spacing={4}>
        <Box
          width="40px"
          height="40px"
          borderRadius="md"
          overflow="hidden"
          bg="gray.100"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {integration.logoUri ? (
            <Image 
              src={integration.logoUri} 
              alt={integration.name} 
              width="100%"
              height="100%"
              objectFit="contain"
            />
          ) : (
            <Text fontSize="xl" fontWeight="bold" color="gray.500">
              {integration.name.charAt(0)}
            </Text>
          )}
        </Box>
        <Box>
          <Text fontWeight="medium">{integration.name}</Text>
          {isError && integration.errors?.length > 0 && (
            <Text fontSize="sm" color="red.500">
              {integration.errors[0].message}
            </Text>
          )}
          {isConnected && (
            <Text fontSize="sm" color="green.600">
              Connected
            </Text>
          )}
        </Box>
      </HStack>

      <Button
        onClick={handleConfigure}
        size="sm"
        colorScheme={isError ? "red" : isConnected ? "green" : "gray"}
        variant="outline"
        _hover={{
          bg: isError ? "red.50" : isConnected ? "green.50" : "gray.100"
        }}
      >
        {isConnected ? 'Configure' : 'Connect'}
      </Button>
    </Flex>
  );
};

const Integrations = () => {
  const integrationApp = useIntegrationApp();
  const [integrations, setIntegrations] = React.useState<Integration[]>([]);

  React.useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const { items } = await integrationApp.integrations.find();
        setIntegrations(items as Integration[]);
      } catch (error) {
        console.error('Error fetching integrations:', error);
      }
    };

    fetchIntegrations();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchIntegrations, 5000);
    return () => clearInterval(interval);
  }, [integrationApp]);

  return (
    <Container maxW="container.lg" pt={8}>
      <VStack align="stretch" spacing={6}>
        <Heading size="xl">Integrations</Heading>
        
        <Box>
          {integrations.map((integration) => (
            <Box key={integration.key} mb={4}>
              <IntegrationItem integration={integration} />
            </Box>
          ))}
        </Box>
      </VStack>
    </Container>
  );
};

export default Integrations; 