/**
 * useOMRModels - React Native hook for model loading and inference
 * Manages model lifecycle, preprocessing, and inference
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import { loadCustomModel, loadMultipleModels, disposeModel, LoadedModel } from './ModelLoader';
import {
  preprocessOCRImage,
  preprocessKeySignatureC,
  preprocessKeySignatureDigit,
  imageToTensor,
  disposeTensor,
} from './ImagePreprocessor';
import { predict, batchPredict, PredictionResult, BatchPredictionResult } from './InferenceEngine';

export interface OMRModelsConfig {
  ocrModelPath: string;
  keySignatureCPath: string;
  keySignatureDigitPath: string;
}

export interface UseOMRModelsReturn {
  // Model loading state
  isLoading: boolean;
  error: string | null;
  modelsLoaded: boolean;

  // Inference functions
  predictSymbol: (imageTensor: tf.Tensor3D) => Promise<PredictionResult>;
  predictKeySignatureC: (imageTensor: tf.Tensor3D) => Promise<PredictionResult>;
  predictKeySignatureDigit: (imageTensor: tf.Tensor3D) => Promise<PredictionResult>;
  predictBatchSymbols: (imageTensors: tf.Tensor3D[]) => Promise<BatchPredictionResult>;

  // Utility functions
  cleanup: () => void;
  getModelInfo: () => Record<string, any>;
}

/**
 * Main hook for using OMR models
 */
export function useOMRModels(config: OMRModelsConfig): UseOMRModelsReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const modelsRef = useRef<{
    ocr?: LoadedModel;
    keySignatureC?: LoadedModel;
    keySignatureDigit?: LoadedModel;
  }>({});

  // Initialize TensorFlow and load models
  useEffect(() => {
    const initModels = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if TensorFlow is ready
        if (!tf.backend()) {
          await tf.setBackend('rn-webgl');
          await tf.ready();
        }

        // Load models
        const models = await loadMultipleModels({
          ocr: config.ocrModelPath,
          keySignatureC: config.keySignatureCPath,
          keySignatureDigit: config.keySignatureDigitPath,
        });

        modelsRef.current = models as any;
        setModelsLoaded(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error loading models';
        setError(errorMsg);
        console.error('Model initialization failed:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    initModels();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [config]);

  // Predict music symbol
  const predictSymbol = useCallback(
    async (imageTensor: tf.Tensor3D): Promise<PredictionResult> => {
      if (!modelsRef.current.ocr) {
        throw new Error('OCR model not loaded');
      }

      return tf.tidy(() => {
        const preprocessed = preprocessOCRImage(imageTensor);
        return predict(modelsRef.current.ocr!, preprocessed, 'ocr');
      });
    },
    []
  );

  // Predict key signature C
  const predictKeySignatureC = useCallback(
    async (imageTensor: tf.Tensor3D): Promise<PredictionResult> => {
      if (!modelsRef.current.keySignatureC) {
        throw new Error('Key Signature C model not loaded');
      }

      return tf.tidy(() => {
        const preprocessed = preprocessKeySignatureC(imageTensor);
        return predict(modelsRef.current.keySignatureC!, preprocessed, 'keySignatureC');
      });
    },
    []
  );

  // Predict key signature digit
  const predictKeySignatureDigit = useCallback(
    async (imageTensor: tf.Tensor3D): Promise<PredictionResult> => {
      if (!modelsRef.current.keySignatureDigit) {
        throw new Error('Key Signature Digit model not loaded');
      }

      return tf.tidy(() => {
        const preprocessed = preprocessKeySignatureDigit(imageTensor);
        return predict(modelsRef.current.keySignatureDigit!, preprocessed, 'keySignatureDigit');
      });
    },
    []
  );

  // Batch predict symbols
  const predictBatchSymbols = useCallback(
    async (imageTensors: tf.Tensor3D[]): Promise<BatchPredictionResult> => {
      if (!modelsRef.current.ocr) {
        throw new Error('OCR model not loaded');
      }

      return tf.tidy(() => {
        const preprocessed = imageTensors.map(img => preprocessOCRImage(img));
        return batchPredict(
          modelsRef.current.ocr!,
          preprocessed as tf.Tensor4D[],
          'ocr'
        );
      });
    },
    []
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    if (modelsRef.current.ocr) {
      disposeModel(modelsRef.current.ocr);
    }
    if (modelsRef.current.keySignatureC) {
      disposeModel(modelsRef.current.keySignatureC);
    }
    if (modelsRef.current.keySignatureDigit) {
      disposeModel(modelsRef.current.keySignatureDigit);
    }
    modelsRef.current = {};
    setModelsLoaded(false);
  }, []);

  // Get model info
  const getModelInfo = useCallback(() => {
    const info: Record<string, any> = {};

    if (modelsRef.current.ocr) {
      const weights = modelsRef.current.ocr.model.getWeights();
      let paramCount = 0;
      weights.forEach(w => {
        paramCount += w.size;
        w.dispose();
      });
      info.ocr = {
        inputShape: modelsRef.current.ocr.inputShape,
        outputShape: modelsRef.current.ocr.outputShape,
        parameters: paramCount,
      };
    }

    if (modelsRef.current.keySignatureC) {
      const weights = modelsRef.current.keySignatureC.model.getWeights();
      let paramCount = 0;
      weights.forEach(w => {
        paramCount += w.size;
        w.dispose();
      });
      info.keySignatureC = {
        inputShape: modelsRef.current.keySignatureC.inputShape,
        outputShape: modelsRef.current.keySignatureC.outputShape,
        parameters: paramCount,
      };
    }

    if (modelsRef.current.keySignatureDigit) {
      const weights = modelsRef.current.keySignatureDigit.model.getWeights();
      let paramCount = 0;
      weights.forEach(w => {
        paramCount += w.size;
        w.dispose();
      });
      info.keySignatureDigit = {
        inputShape: modelsRef.current.keySignatureDigit.inputShape,
        outputShape: modelsRef.current.keySignatureDigit.outputShape,
        parameters: paramCount,
      };
    }

    return info;
  }, []);

  return {
    isLoading,
    error,
    modelsLoaded,
    predictSymbol,
    predictKeySignatureC,
    predictKeySignatureDigit,
    predictBatchSymbols,
    cleanup,
    getModelInfo,
  };
}

/**
 * Higher-level hook for complete music recognition pipeline
 */
export function useMusicRecognition(config: OMRModelsConfig) {
  const models = useOMRModels(config);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    symbol?: PredictionResult;
    keySignature?: PredictionResult;
    digits?: PredictionResult;
  }>({});

  const recognizeSymbol = useCallback(
    async (imageData: Uint8Array, width: number, height: number) => {
      if (!models.modelsLoaded) {
        throw new Error('Models not loaded');
      }

      setIsProcessing(true);
      try {
        const imageTensor = imageToTensor(imageData, width, height, 3) as tf.Tensor3D;
        const symbolResult = await models.predictSymbol(imageTensor);
        setResults(prev => ({ ...prev, symbol: symbolResult }));
        disposeTensor(imageTensor);
        return symbolResult;
      } finally {
        setIsProcessing(false);
      }
    },
    [models]
  );

  const recognizeKeySignature = useCallback(
    async (imageData: Uint8Array, width: number, height: number) => {
      if (!models.modelsLoaded) {
        throw new Error('Models not loaded');
      }

      setIsProcessing(true);
      try {
        const imageTensor = imageToTensor(imageData, width, height, 3) as tf.Tensor3D;
        
        // Parallel inference
        const [cResult, digitResult] = await Promise.all([
          models.predictKeySignatureC(imageTensor),
          models.predictKeySignatureDigit(imageTensor),
        ]);

        setResults(prev => ({
          ...prev,
          keySignature: cResult,
          digits: digitResult,
        }));

        disposeTensor(imageTensor);
        return { cResult, digitResult };
      } finally {
        setIsProcessing(false);
      }
    },
    [models]
  );

  return {
    ...models,
    isProcessing,
    results,
    recognizeSymbol,
    recognizeKeySignature,
  };
}
