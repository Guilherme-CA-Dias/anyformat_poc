import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Heading, 
  SimpleGrid,
  Button,
  Text,
  VStack,
  useDisclosure,
  Image,
  HStack,
} from '@chakra-ui/react';
import { useIntegrationApp } from '@integration-app/react';
import FileSelectionModal from '../components/FileSelectionModal';
import { useAuth } from '../contexts/AuthContext';
import { useFileManagement } from '../hooks/useFileManagement';

interface Connection {
  id: string;
  disconnected: boolean;
  status?: string;
}

interface Integration {
  key: string;
  name: string;
  logoUri?: string;
  connection?: Connection;
  state?: string;
}

const Files = () => {
  const { customer } = useAuth();
  const integrationApp = useIntegrationApp();
  const {
    selectedFiles,
    isDownloading,
    selectFileOrFolder,
    downloadFiles
  } = useFileManagement(customer?.name || 'anonymous');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [files, setFiles] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folderStack, setFolderStack] = useState([{ id: 'root', name: 'My Drive' }]);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    const fetchConnectedIntegrations = async () => {
      try {
        const { items } = await integrationApp.integrations.find();
        const connectedIntegrations = items.filter(integration => 
          integration.connection && 
          !integration.connection.disconnected && 
          integration.state === 'READY'
        );
        setIntegrations(connectedIntegrations as Integration[]);
      } catch (error) {
        console.error('Error fetching integrations:', error);
      }
    };

    fetchConnectedIntegrations();
  }, [integrationApp]);

  const browseFiles = async (integration: Integration, newFolderId?: string) => {
    setSelectedIntegration(integration);
    setIsLoading(true);
    
    const folderId = newFolderId || currentFolderId;
    
    try {
      const { output } = await integrationApp
        .connection(integration.key)
        .action('get-drive-items')
        .run({
          includeFields: true,
          pageSize: 100,
          folderId: folderId !== 'root' ? folderId : undefined
        });

      setFiles(output.records);
      setCurrentFolderId(folderId);
      onOpen();
    } catch (error) {
      console.error('Error browsing files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (file: any) => {
    if (!selectedIntegration) return;
    selectFileOrFolder(file, selectedIntegration);
  };

  const handleDownload = async () => {
    if (selectedFiles.length === 0 || !selectedIntegration) return;
    await downloadFiles(selectedIntegration, integrationApp);
  };

  return (
    <Container maxW="container.lg" pt={8}>
      <VStack align="stretch" spacing={6}>
        <Heading size="xl">Files</Heading>

        <SimpleGrid columns={[1, 2, 3]} spacing={6}>
          {integrations.map((integration) => (
            <Box
              key={integration.key}
              p={5}
              borderWidth="1px"
              borderRadius="lg"
              cursor="pointer"
              onClick={() => browseFiles(integration, 'root')}
              _hover={{ shadow: 'md' }}
            >
              <VStack spacing={4} align="center">
                <Box
                  width="48px"
                  height="48px"
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
                    <Text fontSize="xl">{integration.name.charAt(0)}</Text>
                  )}
                </Box>
                <Text fontWeight="medium">{integration.name}</Text>
                <Button
                  size="sm"
                  width="full"
                  isLoading={isLoading && selectedIntegration?.key === integration.key}
                >
                  Browse Files
                </Button>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>

        {selectedIntegration && (
          <FileSelectionModal
            isOpen={isOpen}
            onClose={onClose}
            files={files}
            selectedFiles={selectedFiles}
            onFileSelect={handleFileSelect}
            searchQuery=""
            onSearchChange={() => {}}
            folderStack={folderStack}
            setFolderStack={setFolderStack}
            browseFiles={(folderId) => browseFiles(selectedIntegration, folderId)}
            isFolderLoading={isLoading}
            isLoadingBackground={false}
          />
        )}

        {selectedFiles.length > 0 && (
          <Box
            position="fixed"
            bottom={0}
            left={0}
            right={0}
            p={4}
            bg="white"
            borderTopWidth={1}
            shadow="lg"
            zIndex={1000}
          >
            <Container maxW="container.lg">
              <HStack justify="space-between" align="center">
                <Text>
                  Selected {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                </Text>
                <Button
                  colorScheme="blue"
                  onClick={handleDownload}
                  isLoading={isDownloading}
                  loadingText="Downloading..."
                >
                  Download Selected Files
                </Button>
              </HStack>
            </Container>
          </Box>
        )}
      </VStack>
    </Container>
  );
};

export default Files; 