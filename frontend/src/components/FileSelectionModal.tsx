import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  VStack,
  HStack,
  Text,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Spinner,
} from '@chakra-ui/react';

interface FileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: any[];
  selectedFiles: any[];
  onFileSelect: (file: any) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  folderStack: Array<{ id: string; name: string }>;
  setFolderStack: (stack: Array<{ id: string; name: string }>) => void;
  browseFiles: (folderId: string) => void;
  isFolderLoading: boolean;
  isLoadingBackground: boolean;
}

const FileSelectionModal: React.FC<FileSelectionModalProps> = ({
  isOpen,
  onClose,
  files,
  selectedFiles,
  onFileSelect,
  searchQuery,
  onSearchChange,
  folderStack,
  setFolderStack,
  browseFiles,
  isFolderLoading,
  isLoadingBackground,
}) => {
  const handleItemClick = (item: any) => {
    if (item.fields?.itemType === 'folder') {
      setFolderStack([...folderStack, { id: item.id, name: item.name }]);
      browseFiles(item.id);
    } else {
      onFileSelect(item);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newStack = folderStack.slice(0, index + 1);
    setFolderStack(newStack);
    browseFiles(newStack[newStack.length - 1].id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent maxW="800px" maxH="80vh">
        <ModalHeader borderBottomWidth="1px">Select Files</ModalHeader>
        
        <Box px={6} py={4} borderBottomWidth="1px">
          <VStack spacing={4} align="stretch">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />

            <Breadcrumb>
              {folderStack.map((folder, index) => (
                <BreadcrumbItem key={folder.id}>
                  <BreadcrumbLink onClick={() => handleBreadcrumbClick(index)}>
                    {folder.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              ))}
            </Breadcrumb>
          </VStack>
        </Box>

        <ModalBody p={0} overflowY="auto">
          <Box p={4}>
            {isFolderLoading ? (
              <Box textAlign="center" py={8}>
                <Spinner />
                <Text mt={2}>Loading folder contents...</Text>
              </Box>
            ) : files.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Text color="gray.500">This folder is empty</Text>
              </Box>
            ) : (
              <VStack align="stretch" spacing={2}>
                {files.map((item) => (
                  <Box
                    key={item.id}
                    p={2}
                    borderWidth="1px"
                    borderRadius="md"
                    cursor="pointer"
                    onClick={() => handleItemClick(item)}
                    bg={selectedFiles.some(f => f.id === item.id) ? 'blue.50' : 'white'}
                    _hover={{ bg: selectedFiles.some(f => f.id === item.id) ? 'blue.100' : 'gray.50' }}
                    position="relative"
                  >
                    <HStack spacing={3}>
                      <Text 
                        fontSize="lg" 
                        color={item.fields?.itemType === 'folder' ? 'yellow.400' : 'gray.400'}
                      >
                        {item.fields?.itemType === 'folder' ? '📁' : '📄'}
                      </Text>
                      <Box flex={1}>
                        <Text fontWeight="medium">
                          {item.name}{item.fileExtension ? `.${item.fileExtension}` : ''}
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          {item.fields?.itemType === 'folder' ? 'Folder' : item.fields?.mimeType}
                        </Text>
                      </Box>
                      {!item.fields?.itemType || item.fields?.itemType !== 'folder' && (
                        <Box
                          w={4}
                          h={4}
                          borderWidth={1}
                          borderRadius="sm"
                          borderColor={selectedFiles.some(f => f.id === item.id) ? 'blue.500' : 'gray.300'}
                          bg={selectedFiles.some(f => f.id === item.id) ? 'blue.500' : 'white'}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          {selectedFiles.some(f => f.id === item.id) && (
                            <Text color="white" fontSize="xs">✓</Text>
                          )}
                        </Box>
                      )}
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </ModalBody>

        <ModalFooter borderTopWidth="1px" bg="gray.50">
          <HStack spacing={4}>
            <Text>
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </Text>
            <Button onClick={onClose}>Close</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default FileSelectionModal; 