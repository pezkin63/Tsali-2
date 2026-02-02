/**
 * SymbolRecognizer - Example component for using OMR models
 * Demonstrates complete integration of model loading and inference
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image as RNImage,
  Alert,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { useMusicRecognition } from './useOMRModels';
import { PredictionResult } from './InferenceEngine';

interface RecognitionState {
  symbol: PredictionResult | null;
  confidence: number;
  timestamp: number;
}

const SymbolRecognizer: React.FC = () => {
  const [recognitionState, setRecognitionState] = useState<RecognitionState>({
    symbol: null,
    confidence: 0,
    timestamp: 0,
  });

  // Initialize models
  const recognition = useMusicRecognition({
    ocrModelPath: require('../models/ocr_model.json'),
    keySignatureCPath: require('../models/keySignatures_c_model.json'),
    keySignatureDigitPath: require('../models/keySignatures_digit_model.json'),
  });

  // Handle model loading
  useEffect(() => {
    if (recognition.error) {
      Alert.alert('Model Loading Error', recognition.error);
    }
  }, [recognition.error]);

  // Example: Recognize symbol from image
  const handleRecognizeSymbol = async (imageUri: string) => {
    if (!recognition.modelsLoaded) {
      Alert.alert('Error', 'Models are still loading');
      return;
    }

    try {
      // In a real app, you'd read the image and convert to tensor
      // This is a simplified example
      Alert.alert('Recognizing...', 'Please wait');

      // TODO: Implement actual image loading from camera or gallery
      // const imageData = await loadImageAsUint8Array(imageUri);
      // const result = await recognition.recognizeSymbol(imageData, width, height);
      // setRecognitionState({
      //   symbol: result,
      //   confidence: result.confidence,
      //   timestamp: result.timestamp,
      // });
    } catch (error) {
      Alert.alert('Recognition Error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Show loading state
  if (recognition.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading OMR Models...</Text>
      </View>
    );
  }

  // Show error state
  if (recognition.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {recognition.error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            // Retry loading
          }}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Music Symbol Recognition</Text>
        {recognition.modelsLoaded && (
          <Text style={styles.statusText}>✓ Models Ready</Text>
        )}
      </View>

      {/* Model Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Model Information</Text>
        <ModelInfoDisplay models={recognition.getModelInfo()} />
      </View>

      {/* Recognition Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capture or Upload Image</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => {
            // TODO: Launch camera
            Alert.alert('Camera', 'Launch camera to capture symbol');
          }}
        >
          <Text style={styles.buttonText}>📷 Capture with Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => {
            // TODO: Open image picker
            Alert.alert('Gallery', 'Select image from gallery');
          }}
        >
          <Text style={styles.buttonText}>🖼️ Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Recognition Results */}
      {recognitionState.symbol && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recognition Result</Text>
          <RecognitionResultDisplay result={recognitionState.symbol} />
        </View>
      )}

      {/* Processing State */}
      {recognition.isProcessing && (
        <View style={styles.section}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.processingText}>Recognizing symbol...</Text>
        </View>
      )}

      {/* Debug Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Information</Text>
        <DebugInfo recognition={recognition} />
      </View>
    </ScrollView>
  );
};

/**
 * Model info display component
 */
const ModelInfoDisplay: React.FC<{ models: Record<string, any> }> = ({ models }) => {
  return (
    <View style={styles.infoCard}>
      {Object.entries(models).map(([name, info]) => (
        <View key={name} style={styles.modelInfo}>
          <Text style={styles.modelName}>{name}</Text>
          <Text style={styles.infoText}>Input: {JSON.stringify(info.inputShape)}</Text>
          <Text style={styles.infoText}>Output: {JSON.stringify(info.outputShape)}</Text>
          <Text style={styles.infoText}>Parameters: {(info.parameters / 1000).toFixed(0)}K</Text>
        </View>
      ))}
    </View>
  );
};

/**
 * Recognition result display component
 */
const RecognitionResultDisplay: React.FC<{ result: PredictionResult }> = ({ result }) => {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.recognizedClass}>{result.className}</Text>
      <View style={styles.confidenceBar}>
        <View
          style={[
            styles.confidenceFill,
            { width: `${result.confidence * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.confidenceText}>
        {(result.confidence * 100).toFixed(2)}% confidence
      </Text>
      <Text style={styles.inferenceTime}>
        Inference time: {result.timestamp.toFixed(2)}ms
      </Text>

      {/* Top-3 predictions */}
      <Text style={styles.subheading}>Top Predictions:</Text>
      {result.allScores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ score, idx }, i) => (
          <Text key={idx} style={styles.predictionItem}>
            {i + 1}. Class {idx}: {(score * 100).toFixed(2)}%
          </Text>
        ))}
    </View>
  );
};

/**
 * Debug info component
 */
const DebugInfo: React.FC<{ recognition: any }> = ({ recognition }) => {
  const modelInfo = recognition.getModelInfo();
  const totalParams = Object.values(modelInfo).reduce(
    (sum: number, info: any) => sum + (info.parameters || 0),
    0
  );

  return (
    <View style={styles.debugCard}>
      <Text style={styles.debugText}>
        Total Parameters: {(totalParams / 1000000).toFixed(2)}M
      </Text>
      <Text style={styles.debugText}>
        Models Loaded: {Object.keys(modelInfo).length}
      </Text>
      <Text style={styles.debugText}>
        Backend: TensorFlow.js RN WebGL
      </Text>
      <Text style={styles.debugText}>
        Status: {recognition.modelsLoaded ? '✓ Ready' : '⏳ Loading'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#E0E0E0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  modelInfo: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modelName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  resultCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 16,
  },
  recognizedClass: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#ccc',
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
    color: '#2e7d32',
    marginBottom: 8,
  },
  inferenceTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  predictionItem: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    marginBottom: 4,
  },
  debugCard: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Menlo',
  },
  processingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default SymbolRecognizer;
