/**
 * useRealOMRModels.ts
 * React hooks for real trained model integration
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import {
  loadAllRealModels,
  disposeRealModel,
  LoadedRealModel,
  RealPredictionResult,
  predictStaff,
  predictSymbol,
} from './RealModelLoader';
import {
  preprocessStaffImage,
  preprocessSymbolImage,
  imageToTensor,
} from './RealImagePreprocessor';

export interface UseRealOMRModelsOptions {
  staffDetectorPath?: string;
  symbolRecognizerPath?: string;
  autoInitialize?: boolean;
  enableLogging?: boolean;
}

export interface RealOMRModelsState {
  staffDetector: LoadedRealModel | null;
  symbolRecognizer: LoadedRealModel | null;
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
  memoryUsage: tf.MemoryInfo | null;
}

export interface RealOMRInference {
  detectStaff: (imageData: Uint8Array, width: number, height: number) => Promise<RealPredictionResult>;
  recognizeSymbol: (imageData: Uint8Array, width: number, height: number) => Promise<RealPredictionResult>;
  batchRecognizeSymbols: (images: Uint8Array[], width: number, height: number) => Promise<RealPredictionResult[]>;
  getMemory: () => tf.MemoryInfo;
  dispose: () => void;
}

/**
 * Main hook for real model management
 */
export function useRealOMRModels(
  options: UseRealOMRModelsOptions = {}
): RealOMRModelsState & RealOMRInference {
  const [state, setState] = useState<RealOMRModelsState>({
    staffDetector: null,
    symbolRecognizer: null,
    isLoading: true,
    error: null,
    isReady: false,
    memoryUsage: null,
  });

  const modelsRef = useRef<{
    staffDetector: LoadedRealModel | null;
    symbolRecognizer: LoadedRealModel | null;
  }>({ staffDetector: null, symbolRecognizer: null });

  const {
    autoInitialize = true,
    enableLogging = true,
    staffDetectorPath,
    symbolRecognizerPath,
  } = options;

  // Initialize models
  useEffect(() => {
    if (!autoInitialize) return;

    const init = async () => {
      try {
        if (enableLogging) {
          console.log('[useRealOMRModels] Initializing TensorFlow...');
        }

        // Initialize TensorFlow
        await tf.ready();

        if (enableLogging) {
          console.log('[useRealOMRModels] Loading models...');
        }

        // Load models in parallel
        const { staffDetector, symbolRecognizer } = await loadAllRealModels({
          staffDetectorPath,
          symbolRecognizerPath,
        });

        modelsRef.current = { staffDetector, symbolRecognizer };

        setState((prev) => ({
          ...prev,
          staffDetector,
          symbolRecognizer,
          isLoading: false,
          isReady: true,
          error: null,
          memoryUsage: tf.memory(),
        }));

        if (enableLogging) {
          console.log('[useRealOMRModels] Models loaded successfully');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMsg,
        }));
        console.error('[useRealOMRModels] Initialization error:', error);
      }
    };

    init();
  }, [autoInitialize, enableLogging, staffDetectorPath, symbolRecognizerPath]);

  // Detect staff lines
  const detectStaff = useCallback(
    async (imageData: Uint8Array, width: number, height: number): Promise<RealPredictionResult> => {
      if (!modelsRef.current.staffDetector) {
        throw new Error('Staff Detector model not loaded');
      }

      return tf.tidy(() => {
        // Create tensor from image data
        let input = imageToTensor(imageData, width, height, 3);

        // Preprocess
        input = preprocessStaffImage(input);

        // Predict
        return predictStaff(modelsRef.current.staffDetector!, input);
      });
    },
    []
  );

  // Recognize symbol
  const recognizeSymbol = useCallback(
    async (imageData: Uint8Array, width: number, height: number): Promise<RealPredictionResult> => {
      if (!modelsRef.current.symbolRecognizer) {
        throw new Error('Symbol Recognizer model not loaded');
      }

      return tf.tidy(() => {
        // Create tensor from image data
        let input = imageToTensor(imageData, width, height, 3);

        // Preprocess
        input = preprocessSymbolImage(input);

        // Predict
        return predictSymbol(modelsRef.current.symbolRecognizer!, input);
      });
    },
    []
  );

  // Batch recognize symbols
  const batchRecognizeSymbols = useCallback(
    async (images: Uint8Array[], width: number, height: number): Promise<RealPredictionResult[]> => {
      if (!modelsRef.current.symbolRecognizer) {
        throw new Error('Symbol Recognizer model not loaded');
      }

      const results: RealPredictionResult[] = [];

      for (const imageData of images) {
        const result = await recognizeSymbol(imageData, width, height);
        results.push(result);
      }

      return results;
    },
    [recognizeSymbol]
  );

  // Get memory
  const getMemory = useCallback(() => {
    const memory = tf.memory();
    setState((prev) => ({ ...prev, memoryUsage: memory }));
    return memory;
  }, []);

  // Dispose
  const dispose = useCallback(() => {
    if (modelsRef.current.staffDetector) {
      disposeRealModel(modelsRef.current.staffDetector);
    }
    if (modelsRef.current.symbolRecognizer) {
      disposeRealModel(modelsRef.current.symbolRecognizer);
    }
    modelsRef.current = { staffDetector: null, symbolRecognizer: null };
    setState((prev) => ({
      ...prev,
      staffDetector: null,
      symbolRecognizer: null,
      isReady: false,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    ...state,
    detectStaff,
    recognizeSymbol,
    batchRecognizeSymbols,
    getMemory,
    dispose,
  };
}

/**
 * Higher-level hook for complete music recognition pipeline
 */
export function useMusicRecognition(options?: UseRealOMRModelsOptions) {
  const models = useRealOMRModels(options);

  const recognizeSheetMusic = useCallback(
    async (
      imageData: Uint8Array,
      width: number,
      height: number
    ): Promise<{
      staffDetection: RealPredictionResult;
      symbolRecognition: RealPredictionResult;
      totalTime: number;
    }> => {
      const startTime = performance.now();

      try {
        // Detect staff
        const staffDetection = await models.detectStaff(imageData, width, height);

        // Recognize symbol
        const symbolRecognition = await models.recognizeSymbol(imageData, width, height);

        const totalTime = performance.now() - startTime;

        return {
          staffDetection,
          symbolRecognition,
          totalTime,
        };
      } catch (error) {
        console.error('[useMusicRecognition] Error:', error);
        throw error;
      }
    },
    [models]
  );

  return {
    ...models,
    recognizeSheetMusic,
  };
}
