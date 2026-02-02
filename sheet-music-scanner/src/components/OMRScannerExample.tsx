/**
 * Complete Example: Music Symbol Recognition from Camera
 * This demonstrates the full integration pipeline
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import RNFS from 'react-native-fs';
import * as tf from '@tensorflow/tfjs';
import { useMusicRecognition } from './ml/useOMRModels';
import { imageToTensor, disposeTensor } from './ml/ImagePreprocessor';
import { PredictionResult, analyzeUncertainty } from './ml/InferenceEngine';

interface RecognitionHistoryItem {
  symbol: string;
  confidence: number;
  timestamp: Date;
  uncertainty: {
    entropy: number;
    topK_prob: number;
    isConfident: boolean;
  };
}

export const OMRScannerExample: React.FC = () => {
  const cameraRef = useRef<RNCamera>(null);
  const [recognition, setRecognition] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<RecognitionHistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    totalScanned: 0,
    averageConfidence: 0,
    successRate: 0,
  });

  // Initialize models
  const models = useMusicRecognition({
    ocrModelPath: require('../models/ocr_model.json'),
    keySignatureCPath: require('../models/keySignatures_c_model.json'),
    keySignatureDigitPath: require('../models/keySignatures_digit_model.json'),
  });

  // Handle errors
  useEffect(() => {
    if (models.error) {
      Alert.alert('Model Error', models.error);
    }
  }, [models.error]);

  /**
   * Capture and process image from camera
   */
  const handleCapture = async () => {
    if (!cameraRef.current || !models.modelsLoaded) {
      Alert.alert('Not Ready', 'Models are still loading...');
      return;
    }

    setIsProcessing(true);

    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        fixOrientation: true,
        pauseAfterCapture: true,
      });

      if (!photo.base64) {
        throw new Error('Failed to capture image');
      }

      // Convert base64 to Uint8Array
      const binaryString = atob(photo.base64);
      const imageData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imageData[i] = binaryString.charCodeAt(i);
      }

      // Get actual image dimensions (from camera)
      const imageTensor = imageToTensor(imageData, photo.width, photo.height, 3);

      // Run all recognitions in parallel
      const [symbolResult, keyResult, digitResult] = await Promise.all([
        models.recognizeSymbol(imageData, photo.width, photo.height),
        models.recognizeKeySignature(imageData, photo.width, photo.height),
        // Note: keyResult is { cResult, digitResult }
      ]);

      // Process results
      const result = symbolResult;
      const uncertainty = analyzeUncertainty(result);

      setRecognition(result);

      // Update history
      const historyItem: RecognitionHistoryItem = {
        symbol: result.className,
        confidence: result.confidence,
        timestamp: new Date(),
        uncertainty,
      };

      setHistory(prev => [historyItem, ...prev].slice(0, 10));

      // Update statistics
      setStats(prev => {
        const newTotal = prev.totalScanned + 1;
        const newAvgConfidence =
          (prev.averageConfidence * prev.totalScanned + result.confidence) / newTotal;
        const newSuccessRate = uncertainty.isConfident ? 100 : 0;

        return {
          totalScanned: newTotal,
          averageConfidence: newAvgConfidence,
          successRate: newSuccessRate,
        };
      });

      // Clean up
      disposeTensor(imageTensor);

      // Show result alert
      Alert.alert(
        'Recognition Complete',
        `Symbol: ${result.className}\nConfidence: ${(result.confidence * 100).toFixed(2)}%\nTime: ${result.timestamp.toFixed(0)}ms`,
        [
          { text: 'OK' },
          {
            text: 'Details',
            onPress: () => showDetailedResults(result),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
      // Resume camera preview
      if (cameraRef.current) {
        cameraRef.current.resumePreview();
      }
    }
  };

  /**
   * Show detailed prediction results
   */
  const showDetailedResults = (result: PredictionResult) => {
    const topK = result.allScores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const details = topK
      .map((item, i) => `${i + 1}. Class ${item.idx}: ${(item.score * 100).toFixed(2)}%`)
      .join('\n');

    Alert.alert('Detailed Results', details);
  };

  /**
   * Clear history and stats
   */
  const handleReset = () => {
    setRecognition(null);
    setHistory([]);
    setStats({ totalScanned: 0, averageConfidence: 0, successRate: 0 });
  };

  // Loading state
  if (models.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading OMR Models...</Text>
      </View>
    );
  }

  // Error state
  if (models.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {models.error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => {}}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Camera Preview */}
      <View style={styles.cameraSection}>
        <RNCamera
          ref={cameraRef}
          style={styles.camera}
          type={RNCamera.Constants.Type.back}
          flashMode={RNCamera.Constants.FlashMode.auto}
          captureAudio={false}
          androidCameraPermissionOptions={{
            title: 'Permission to use camera',
            message: 'We need your permission to use your camera',
            buttonPositive: 'Ok',
            buttonNegative: 'Cancel',
          }}
        >
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraHint}>Position music symbol in frame</Text>
          </View>
        </RNCamera>

        {/* Capture Button */}
        <TouchableOpacity
          style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={isProcessing || !models.modelsLoaded}
        >
          <Text style={styles.captureButtonText}>
            {isProcessing ? '⏳ Processing...' : '📷 Capture & Recognize'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Current Recognition Result */}
      {recognition && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Current Recognition</Text>
          <View style={styles.resultCard}>
            <Text style={styles.recognizedSymbol}>{recognition.className}</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${recognition.confidence * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.confidenceText}>
              {(recognition.confidence * 100).toFixed(2)}% confidence
            </Text>
            <Text style={styles.inferenceTime}>
              Inference: {recognition.timestamp.toFixed(1)}ms
            </Text>
          </View>
        </View>
      )}

      {/* Statistics */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalScanned}</Text>
            <Text style={styles.statLabel}>Scanned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{(stats.averageConfidence * 100).toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Avg Confidence</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.successRate.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>
      </View>

      {/* History */}
      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recognition History</Text>
          {history.map((item, idx) => (
            <View key={idx} style={styles.historyItem}>
              <Text style={styles.historySymbol}>{item.symbol}</Text>
              <View style={styles.historyRight}>
                <Text style={styles.historyConfidence}>
                  {(item.confidence * 100).toFixed(0)}%
                </Text>
                <Text style={styles.historyTime}>
                  {item.timestamp.toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Controls */}
      <View style={styles.controlsSection}>
        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
        >
          <Text style={styles.buttonText}>Clear History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={() => {
            const info = models.getModelInfo();
            Alert.alert(
              'Model Information',
              JSON.stringify(info, null, 2)
            );
          }}
        >
          <Text style={styles.buttonText}>Model Info</Text>
        </TouchableOpacity>
      </View>

      {/* Memory Info */}
      <View style={styles.debugSection}>
        <Text style={styles.debugTitle}>Memory Usage</Text>
        <Text style={styles.debugText}>
          Tensors: {tf.memory().numTensors}
        </Text>
        <Text style={styles.debugText}>
          Bytes: {(tf.memory().numBytes / 1024).toFixed(1)} KB
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
  },
  cameraSection: {
    height: 400,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHint: {
    fontSize: 16,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  captureButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  captureButtonDisabled: {
    backgroundColor: '#ccc',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recognizedSymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 12,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  inferenceTime: {
    fontSize: 12,
    color: '#999',
  },
  statsSection: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  historySection: {
    padding: 16,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historySymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyConfidence: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  historyTime: {
    fontSize: 11,
    color: '#999',
  },
  controlsSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
  },
  infoButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  debugSection: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    marginBottom: 16,
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
});

export default OMRScannerExample;
