import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@utils/constants';

interface FilePickerScreenProps {
  navigation: any;
}

const FilePickerScreen: React.FC<FilePickerScreenProps> = ({ navigation }) => {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickFile = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });

      if (result.type === 'success') {
        setSelectedFile(result);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessFile = () => {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select a file first');
      return;
    }

    if (selectedFile.type === 'pdf') {
      // Handle PDF import
      Alert.alert('PDF Support', 'PDF processing is coming soon!');
    } else {
      // Handle image import
      navigation.navigate('ImageEditor', { imageUri: selectedFile.uri });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Files</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.illustration}>
          <MaterialIcons name="folder-open" size={80} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Import Music Files</Text>
        <Text style={styles.subtitle}>
          Select PDF files or images from your device
        </Text>

        <View style={styles.supportedFormats}>
          <Text style={styles.formatsTitle}>Supported Formats</Text>
          <View style={styles.formatsList}>
            <FormatItem icon="image" format="JPEG, PNG" />
            <FormatItem icon="description" format="PDF" />
          </View>
        </View>

        {selectedFile && (
          <View style={styles.selectedFileContainer}>
            <MaterialIcons name="check-circle" size={24} color={COLORS.success} />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={styles.fileSize}>
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedFile(null)}
              style={styles.clearButton}
            >
              <MaterialIcons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={pickFile}
          disabled={isLoading}
        >
          <View style={styles.primaryButtonContent}>
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <MaterialIcons name="cloud-upload" size={24} color="white" />
                <Text style={styles.primaryButtonText}>Choose File</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {selectedFile && (
          <TouchableOpacity
            style={styles.processButton}
            onPress={handleProcessFile}
          >
            <View style={styles.processButtonContent}>
              <MaterialIcons name="arrow-forward" size={20} color="white" />
              <Text style={styles.processButtonText}>Process File</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.info}>
          <MaterialIcons name="info" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            For best results, use high-quality images or PDFs with clear sheet music.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const FormatItem: React.FC<{ icon: string; format: string }> = ({ icon, format }) => (
  <View style={styles.formatItem}>
    <MaterialIcons name={icon} size={20} color={COLORS.primary} />
    <Text style={styles.formatText}>{format}</Text>
  </View>
);

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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body1,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  supportedFormats: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  formatsTitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  formatsList: {
    gap: SPACING.md,
  },
  formatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  formatText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(52, 168, 83, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text,
    fontWeight: '600',
  },
  fileSize: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.button,
    color: 'white',
    fontWeight: '700',
  },
  processButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  processButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  processButtonText: {
    ...TYPOGRAPHY.button,
    color: 'white',
    fontWeight: '700',
  },
  info: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
  },
  infoText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text,
    flex: 1,
  },
});

export default FilePickerScreen;
