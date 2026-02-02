import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  StyleSheet,
  Image,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FILE_PATHS } from '@utils/constants';
import { generateId } from '@utils/helpers';
import { StorageService } from '@services/storage';
import { ScannedItem } from '@utils/types';

interface ImageEditorScreenProps {
  route: any;
  navigation: any;
}

const ImageEditorScreen: React.FC<ImageEditorScreenProps> = ({ route, navigation }) => {
  const { imageUri } = route.params;
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedUri, setProcessedUri] = useState(imageUri);

  const applyEffects = async () => {
    try {
      setIsProcessing(true);

      let result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            rotate: rotation,
          },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      setProcessedUri(result.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error applying effects:', error);
      Alert.alert('Error', 'Failed to apply effects');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveImage = async () => {
    try {
      setIsProcessing(true);

      // Create directory if it doesn't exist
      const directory = `${FileSystem.documentDirectory}${FILE_PATHS.SCANS}`;
      try {
        await FileSystem.readDirectoryAsync(directory);
      } catch {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }

      // Save image
      const filename = `scan_${generateId()}.jpg`;
      const filepath = `${directory}${filename}`;

      await FileSystem.copyAsync({
        from: processedUri,
        to: filepath,
      });

      // Create thumbnail
      const thumbnail = await ImageManipulator.manipulateAsync(
        filepath,
        [{ resize: { width: 150, height: 200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const thumbnailPath = `${FileSystem.documentDirectory}${FILE_PATHS.THUMBNAILS}thumb_${filename}`;
      const thumbnailDir = `${FileSystem.documentDirectory}${FILE_PATHS.THUMBNAILS}`;
      try {
        await FileSystem.readDirectoryAsync(thumbnailDir);
      } catch {
        await FileSystem.makeDirectoryAsync(thumbnailDir, { intermediates: true });
      }

      await FileSystem.copyAsync({
        from: thumbnail.uri,
        to: thumbnailPath,
      });

      // Create and save scanned item metadata
      const itemId = generateId();
      
      // Generate demo music data with SATB voices
      const demoMusicData = generateDemoMusicData();
      
      const scannedItem: ScannedItem = {
        id: itemId,
        filename: filename,
        imagePath: filepath,
        thumbnailPath: thumbnailPath,
        dateScanned: Date.now(),
        duration: 0,
        title: `Scan ${new Date().toLocaleDateString()}`,
        description: '',
        musicData: demoMusicData,
        playCount: 0,
        lastPlayed: null,
      };

      // Save to storage
      await StorageService.addScannedItem(scannedItem);

      // Navigate to viewer with saved item
      navigation.navigate('Viewer', {
        itemId: itemId,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateDemoMusicData = (): MusicData => {
    // Generate demo music data with SATB voices for testing
    return {
      title: 'Scanned Sheet Music',
      composer: 'Unknown Composer',
      timeSignature: '4/4',
      tempo: 120,
      key: 'C Major',
      confidence: 0.85,
      noteCount: 16,
      pages: 1,
      currentPage: 1,
      measures: [
        {
          number: 1,
          timeSignature: '4/4',
          notes: [
            { pitch: 'C', octave: 5, duration: 0.5, voice: 'soprano' },
            { pitch: 'D', octave: 5, duration: 0.5, voice: 'soprano' },
            { pitch: 'E', octave: 5, duration: 0.5, voice: 'soprano' },
            { pitch: 'F', octave: 5, duration: 0.5, voice: 'soprano' },
            { pitch: 'G', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'A', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'B', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'C', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'E', octave: 3, duration: 0.5, voice: 'tenor' },
            { pitch: 'F', octave: 3, duration: 0.5, voice: 'tenor' },
            { pitch: 'G', octave: 3, duration: 0.5, voice: 'tenor' },
            { pitch: 'A', octave: 3, duration: 0.5, voice: 'tenor' },
            { pitch: 'C', octave: 2, duration: 0.5, voice: 'bass' },
            { pitch: 'D', octave: 2, duration: 0.5, voice: 'bass' },
            { pitch: 'E', octave: 2, duration: 0.5, voice: 'bass' },
            { pitch: 'F', octave: 2, duration: 0.5, voice: 'bass' },
          ],
        },
        {
          number: 2,
          timeSignature: '4/4',
          notes: [
            { pitch: 'G', octave: 5, duration: 0.5, voice: 'soprano' },
            { pitch: 'A', octave: 5, duration: 0.5, voice: 'soprano' },
            { pitch: 'B', octave: 5, duration: 0.5, voice: 'soprano' },
            { pitch: 'C', octave: 6, duration: 0.5, voice: 'soprano' },
            { pitch: 'D', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'E', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'F', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'G', octave: 4, duration: 0.5, voice: 'alto' },
            { pitch: 'B', octave: 3, duration: 0.5, voice: 'tenor' },
            { pitch: 'C', octave: 4, duration: 0.5, voice: 'tenor' },
            { pitch: 'D', octave: 4, duration: 0.5, voice: 'tenor' },
            { pitch: 'E', octave: 4, duration: 0.5, voice: 'tenor' },
            { pitch: 'G', octave: 2, duration: 0.5, voice: 'bass' },
            { pitch: 'A', octave: 2, duration: 0.5, voice: 'bass' },
            { pitch: 'B', octave: 2, duration: 0.5, voice: 'bass' },
            { pitch: 'C', octave: 3, duration: 0.5, voice: 'bass' },
          ],
        },
      ],
    };
  };

  const rotateImage = (degrees: number) => {
    setRotation((current) => (current + degrees) % 360);
  };

  const resetEdits = () => {
    setBrightness(0);
    setContrast(0);
    setRotation(0);
    setProcessedUri(imageUri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Image</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Preview */}
        <View style={styles.previewContainer}>
          <Image source={{ uri: processedUri }} style={styles.imagePreview} />
        </View>

        {/* Editing Controls */}
        <View style={styles.controlsSection}>
          <Text style={styles.sectionTitle}>Adjustments</Text>

          {/* Brightness */}
          <View style={styles.control}>
            <View style={styles.controlHeader}>
              <MaterialIcons name="brightness-4" size={24} color={COLORS.primary} />
              <Text style={styles.controlLabel}>Brightness</Text>
              <Text style={styles.controlValue}>{brightness}</Text>
            </View>
            <Slider
              style={styles.slider}
              value={brightness}
              onValueChange={setBrightness}
              minimumValue={-50}
              maximumValue={50}
              step={1}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor={COLORS.border}
            />
          </View>

          {/* Contrast */}
          <View style={styles.control}>
            <View style={styles.controlHeader}>
              <MaterialIcons name="contrast" size={24} color={COLORS.primary} />
              <Text style={styles.controlLabel}>Contrast</Text>
              <Text style={styles.controlValue}>{contrast}</Text>
            </View>
            <Slider
              style={styles.slider}
              value={contrast}
              onValueChange={setContrast}
              minimumValue={-50}
              maximumValue={50}
              step={1}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor={COLORS.border}
            />
          </View>

          {/* Rotation */}
          <View style={styles.control}>
            <View style={styles.controlHeader}>
              <MaterialIcons name="rotate-right" size={24} color={COLORS.primary} />
              <Text style={styles.controlLabel}>Rotation</Text>
              <Text style={styles.controlValue}>{rotation}°</Text>
            </View>
            <View style={styles.rotationButtons}>
              <TouchableOpacity
                style={styles.rotationButton}
                onPress={() => rotateImage(-90)}
              >
                <MaterialIcons name="rotate-left" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rotationButton}
                onPress={() => rotateImage(90)}
              >
                <MaterialIcons name="rotate-right" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Convert to Grayscale */}
          <TouchableOpacity style={styles.optionButton}>
            <MaterialIcons name="color-lens" size={24} color={COLORS.primary} />
            <Text style={styles.optionButtonText}>Convert to Grayscale</Text>
          </TouchableOpacity>

          {/* Crop */}
          <TouchableOpacity style={styles.optionButton}>
            <MaterialIcons name="crop" size={24} color={COLORS.primary} />
            <Text style={styles.optionButtonText}>Crop to Music Area</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryAction]}
            onPress={resetEdits}
          >
            <MaterialIcons name="refresh" size={20} color={COLORS.primary} />
            <Text style={styles.secondaryActionText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryAction]}
            onPress={applyEffects}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color={COLORS.primary} />
                <Text style={styles.secondaryActionText}>Apply</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isProcessing && styles.saveButtonDisabled]}
          onPress={saveImage}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color="white" />
              <Text style={styles.saveButtonText}>Save & Process</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  content: {
    flex: 1,
    paddingVertical: SPACING.lg,
  },
  previewContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  imagePreview: {
    width: '100%',
    height: 300,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  controlsSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  control: {
    gap: SPACING.md,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  controlLabel: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text,
    flex: 1,
  },
  controlValue: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  slider: {
    height: 40,
  },
  rotationButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  rotationButton: {
    flex: 1,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  optionButtonText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  secondaryAction: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  secondaryActionText: {
    ...TYPOGRAPHY.button,
    color: COLORS.primary,
  },
  saveButton: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...TYPOGRAPHY.button,
    color: 'white',
    fontWeight: '700',
  },
});

export default ImageEditorScreen;
