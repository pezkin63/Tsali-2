import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { OMRService } from '@services/omr';

const { width, height } = Dimensions.get('window');

interface CameraScreenProps {
  route: any;
  navigation: any;
}

export function CameraScreen({ navigation }: CameraScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionProgress, setRecognitionProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Initialize music recognition service
  useEffect(() => {
    const initializeService = async () => {
      try {
        await musicRecognitionService.initialize((msg, progress) => {
          setProgressMessage(msg);
          setRecognitionProgress(progress);
        });
      } catch (error) {
        console.error('Failed to initialize recognition service:', error);
        Alert.alert(
          'Error',
          'Failed to initialize music recognition service'
        );
      }
    };

    if (isFocused) {
      initializeService();
    }
  }, [isFocused]);

  // Handle screen focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsFocused(true);
    });
    return unsubscribe;
  }, [navigation]);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>Loading camera...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>We need camera access to scan sheet music</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /**
   * Capture and process image
   */
  const handleCapture = async () => {
    if (!cameraRef.current || isRecognizing) return;

    try {
      setIsRecognizing(true);
      setProgressMessage('Capturing image...');
      setRecognitionProgress(0);

      // Take photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false
      });

      setProgressMessage('Processing image...');
      setRecognitionProgress(0.2);

      // Recognize music using real OMR service
      const result = await OMRService.processImage(photo.uri, {
        enhanceImage: true,
        returnConfidence: true
      });

      if (result.success && result.musicData) {
        // Navigate to viewer with results
        navigation.navigate('ViewerEnhanced', {
          musicData: result.musicData,
          symbols: [],
          confidence: result.confidence || 0.85,
          processingTime: result.processingTime || 0
        });
      } else {
        Alert.alert('Recognition Failed', result.error || 'Unable to recognize sheet music');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to process image: ${errorMsg}`);
      console.error('Capture error:', error);
    } finally {
      setIsRecognizing(false);
      setProgressMessage('');
      setRecognitionProgress(0);
    }
  };

  /**
   * Handle focus tap
   */
  const handleTapToFocus = async (event: any) => {
    if (!cameraRef.current) return;

    const { locationX, locationY } = event.nativeEvent;
    const x = locationX / width;
    const y = locationY / height;

    try {
      await cameraRef.current.pausePreview();
      await cameraRef.current.resumePreview();
    } catch (error) {
      console.warn('Focus error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        onTouchStart={handleTapToFocus}
        ratio="16:9"
      >
        {/* Grid overlay */}
        <View style={styles.gridOverlay}>
          <View style={styles.gridRow} />
          <View style={styles.gridRow} />
        </View>

        {/* Corner indicators */}
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />

        {/* Processing overlay */}
        {isRecognizing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>{progressMessage}</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${recognitionProgress * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.progressPercent}>
              {Math.round(recognitionProgress * 100)}%
            </Text>
          </View>
        )}
      </CameraView>

      {/* Bottom controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.captureButton, isRecognizing && styles.disabled]}
          onPress={handleCapture}
          disabled={isRecognizing}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        <Text style={styles.instructionText}>
          Align sheet music and tap to capture
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gridOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'space-around'
  },
  gridRow: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%'
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 40,
    left: 40,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#fff',
    borderLeftColor: '#fff'
  },
  cornerTopRight: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopColor: '#fff',
    borderRightColor: '#fff'
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 80,
    left: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomColor: '#fff',
    borderLeftColor: '#fff'
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 80,
    right: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomColor: '#fff',
    borderRightColor: '#fff'
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center'
  },
  progressBarContainer: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50'
  },
  progressPercent: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8
  },
  controls: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center'
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50'
  },
  disabled: {
    opacity: 0.5
  },
  instructionText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center'
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center'
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    marginTop: 16
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
