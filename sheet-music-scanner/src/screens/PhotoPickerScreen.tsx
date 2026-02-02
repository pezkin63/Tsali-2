import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@utils/constants';

interface PhotoPickerScreenProps {
  navigation: any;
}

const PhotoPickerScreen: React.FC<PhotoPickerScreenProps> = ({ navigation }) => {
  const [photos, setPhotos] = useState<any[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  useEffect(() => {
    requestPhotoPermission();
  }, []);

  const requestPhotoPermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setPermissionStatus(status);
      if (status === 'granted') {
        loadPhotos();
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request photo permission');
    }
  };

  const loadPhotos = async () => {
    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultiple: true,
        quality: 1,
      });

      if (!result.canceled) {
        setPhotos(result.assets);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePhotoSelection = (photoUri: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoUri)) {
      newSelected.delete(photoUri);
    } else {
      newSelected.add(photoUri);
    }
    setSelectedPhotos(newSelected);
  };

  const handleProcessPhotos = async () => {
    if (selectedPhotos.size === 0) {
      Alert.alert('No Selection', 'Please select at least one photo');
      return;
    }

    // For now, navigate to image editor with the first selected photo
    const firstPhoto = Array.from(selectedPhotos)[0];
    navigation.navigate('ImageEditor', { imageUri: firstPhoto });
  };

  const renderPhotoItem = ({ item }: { item: any }) => {
    const isSelected = selectedPhotos.has(item.uri);

    return (
      <TouchableOpacity
        style={[styles.photoItem, isSelected && styles.photoItemSelected]}
        onPress={() => togglePhotoSelection(item.uri)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.uri }} style={styles.photoImage} />
        {isSelected && (
          <View style={styles.photoCheckmark}>
            <MaterialIcons name="check" size={24} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (permissionStatus !== 'granted') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="lock" size={64} color={COLORS.error} />
          <Text style={styles.permissionTitle}>Permission Denied</Text>
          <Text style={styles.permissionText}>
            Tsali Scanner needs access to your photo library to select images.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPhotoPermission}
          >
            <MaterialIcons name="settings" size={20} color="white" />
            <Text style={styles.permissionButtonText}>Enable Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Photos</Text>
        {selectedPhotos.size > 0 && (
          <Text style={styles.selectedCount}>{selectedPhotos.size}</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <>
          <FlatList
            data={photos}
            renderItem={renderPhotoItem}
            keyExtractor={(item) => item.uri}
            numColumns={3}
            columnWrapperStyle={styles.photoGrid}
            contentContainerStyle={styles.photosContainer}
            scrollEnabled={true}
          />

          {selectedPhotos.size > 0 && (
            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setSelectedPhotos(new Set())}
              >
                <Text style={styles.cancelButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.processButton]}
                onPress={handleProcessPhotos}
              >
                <View style={styles.processButtonContent}>
                  <MaterialIcons name="check" size={20} color="white" />
                  <Text style={styles.processButtonText}>
                    Process ({selectedPhotos.size})
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
  },
  selectedCount: {
    ...TYPOGRAPHY.body1,
    color: COLORS.primary,
    fontWeight: '700',
    backgroundColor: 'rgba(26, 115, 232, 0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  permissionTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  permissionText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  permissionButtonText: {
    ...TYPOGRAPHY.button,
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photosContainer: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingBottom: 100,
  },
  photoGrid: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  photoItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  photoItemSelected: {
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCheckmark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 115, 232, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.text,
  },
  processButton: {
    backgroundColor: COLORS.primary,
  },
  processButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  processButtonText: {
    ...TYPOGRAPHY.button,
    color: 'white',
    fontWeight: '700',
  },
});

export default PhotoPickerScreen;
