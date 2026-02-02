/**
 * RealModelLoader.ts
 * Loads actual trained TensorFlow.js models for sheet music recognition
 * 
 * Models:
 * - Staff Detector: Detects staff lines in sheet music (128x128 input)
 * - Symbol Recognizer: Recognizes music symbols (32x32 input, 3 classes)
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

export interface LoadedRealModel {
  model: tf.LayersModel;
  modelType: 'staff_detector' | 'symbol_recognizer';
  inputShape: number[];
  outputShape: number[];
  predict: (input: tf.Tensor) => tf.Tensor;
}

export interface RealPredictionResult {
  modelType: 'staff_detector' | 'symbol_recognizer';
  predictions: number[];
  topClass?: number;
  confidence?: number;
  interpretations?: string[];
  timing: {
    loadTime?: number;
    inferenceTime: number;
  };
}

/**
 * Load Staff Detector model
 * Input: 128x128 grayscale image
 * Output: Binary classification (staff/no-staff) or heatmap
 */
export async function loadStaffDetector(
  modelPath: string = 'assets/models/staff_detector_tfjs/model.json'
): Promise<LoadedRealModel> {
  const startTime = performance.now();

  try {
    console.log('[StaffDetector] Loading model from:', modelPath);

    const model = await tf.loadLayersModel(`file://${modelPath}`);

    const loadTime = performance.now() - startTime;
    console.log(`[StaffDetector] Model loaded in ${loadTime.toFixed(2)}ms`);

    return {
      model,
      modelType: 'staff_detector',
      inputShape: [128, 128, 1], // 128x128 grayscale
      outputShape: model.outputs[0].shape as number[],
      predict: (input: tf.Tensor) => model.predict(input) as tf.Tensor,
    };
  } catch (error) {
    console.error('[StaffDetector] Failed to load model:', error);
    throw new Error(`Failed to load Staff Detector: ${error}`);
  }
}

/**
 * Load Symbol Recognizer model
 * Input: 32x32 grayscale image
 * Output: 3-class classification (class 11, 13, 33)
 */
export async function loadSymbolRecognizer(
  modelPath: string = 'assets/models/symbol_recognizer_tfjs/model.json'
): Promise<LoadedRealModel> {
  const startTime = performance.now();

  try {
    console.log('[SymbolRecognizer] Loading model from:', modelPath);

    const model = await tf.loadLayersModel(`file://${modelPath}`);

    const loadTime = performance.now() - startTime;
    console.log(`[SymbolRecognizer] Model loaded in ${loadTime.toFixed(2)}ms`);

    return {
      model,
      modelType: 'symbol_recognizer',
      inputShape: [32, 32, 1], // 32x32 grayscale
      outputShape: model.outputs[0].shape as number[],
      predict: (input: tf.Tensor) => model.predict(input) as tf.Tensor,
    };
  } catch (error) {
    console.error('[SymbolRecognizer] Failed to load model:', error);
    throw new Error(`Failed to load Symbol Recognizer: ${error}`);
  }
}

/**
 * Load both models in parallel
 */
export async function loadAllRealModels(options?: {
  staffDetectorPath?: string;
  symbolRecognizerPath?: string;
}) {
  try {
    console.log('[RealModelLoader] Loading all models in parallel...');

    const [staffDetector, symbolRecognizer] = await Promise.all([
      loadStaffDetector(options?.staffDetectorPath),
      loadSymbolRecognizer(options?.symbolRecognizerPath),
    ]);

    console.log('[RealModelLoader] All models loaded successfully');

    return { staffDetector, symbolRecognizer };
  } catch (error) {
    console.error('[RealModelLoader] Failed to load models:', error);
    throw error;
  }
}

/**
 * Run inference on Staff Detector
 */
export async function predictStaff(
  model: LoadedRealModel,
  input: tf.Tensor
): Promise<RealPredictionResult> {
  if (model.modelType !== 'staff_detector') {
    throw new Error('Expected staff_detector model');
  }

  const startTime = performance.now();

  return tf.tidy(() => {
    const output = model.predict(input);
    const predictions = Array.from(
      (output as any).dataSync ? (output as any).dataSync() : []
    );

    const inferenceTime = performance.now() - startTime;

    // Interpret predictions
    let interpretations: string[] = [];
    if (predictions.length > 0) {
      const confidence = predictions[0];
      if (confidence > 0.7) {
        interpretations.push('Strong staff detected');
      } else if (confidence > 0.5) {
        interpretations.push('Possible staff line');
      } else {
        interpretations.push('No staff detected');
      }
    }

    return {
      modelType: 'staff_detector',
      predictions,
      topClass: predictions.length > 0 ? 1 : 0,
      confidence: predictions[0] || 0,
      interpretations,
      timing: { inferenceTime },
    };
  });
}

/**
 * Run inference on Symbol Recognizer
 * Classes: 11 (class 0), 13 (class 1), 33 (class 2)
 */
export async function predictSymbol(
  model: LoadedRealModel,
  input: tf.Tensor
): Promise<RealPredictionResult> {
  if (model.modelType !== 'symbol_recognizer') {
    throw new Error('Expected symbol_recognizer model');
  }

  const startTime = performance.now();
  const classNames = ['Symbol_11', 'Symbol_13', 'Symbol_33'];

  return tf.tidy(() => {
    const output = model.predict(input);
    const predictions = Array.from(
      (output as any).dataSize !== undefined
        ? (output as any).dataSync()
        : (output as any).data
    );

    const inferenceTime = performance.now() - startTime;

    // Get top prediction
    const topClass = predictions.indexOf(Math.max(...predictions));
    const confidence = predictions[topClass];

    // Softmax for better probability interpretation
    const softmaxPreds = softmax(predictions);

    return {
      modelType: 'symbol_recognizer',
      predictions: softmaxPreds,
      topClass,
      confidence: softmaxPreds[topClass],
      interpretations: [
        `Recognized: ${classNames[topClass]} (${(softmaxPreds[topClass] * 100).toFixed(1)}%)`,
      ],
      timing: { inferenceTime },
    };
  });
}

/**
 * Batch predict symbols
 */
export async function batchPredictSymbols(
  model: LoadedRealModel,
  inputs: tf.Tensor[]
): Promise<RealPredictionResult[]> {
  if (model.modelType !== 'symbol_recognizer') {
    throw new Error('Expected symbol_recognizer model');
  }

  const startTime = performance.now();
  const classNames = ['Symbol_11', 'Symbol_13', 'Symbol_33'];

  const results = await Promise.all(
    inputs.map(async (input) => {
      return predictSymbol(model, input);
    })
  );

  const batchTime = performance.now() - startTime;
  console.log(
    `[BatchPredict] Processed ${inputs.length} symbols in ${batchTime.toFixed(2)}ms`
  );

  return results;
}

/**
 * Softmax function for probability normalization
 */
function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const expArr = arr.map((x) => Math.exp(x - max));
  const sum = expArr.reduce((a, b) => a + b, 0);
  return expArr.map((x) => x / sum);
}

/**
 * Get uncertainty metrics
 */
export function getUncertaintyMetrics(predictions: number[]) {
  const softmaxPreds = softmax(predictions);
  const topProb = Math.max(...softmaxPreds);
  const entropy = -softmaxPreds.reduce(
    (sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0),
    0
  );

  return {
    topProbability: topProb,
    entropy,
    isConfident: topProb > 0.7,
    isUncertain: topProb < 0.5,
  };
}

/**
 * Dispose model and free memory
 */
export function disposeRealModel(model: LoadedRealModel): void {
  if (model && model.model) {
    try {
      model.model.dispose();
      console.log(`[RealModelLoader] Disposed ${model.modelType} model`);
    } catch (error) {
      console.error(`Failed to dispose model: ${error}`);
    }
  }
}

/**
 * Get memory usage
 */
export function getMemoryUsage() {
  return tf.memory();
}

/**
 * Log model details
 */
export function logModelDetails(model: LoadedRealModel): void {
  console.log(`
    ╔═══════════════════════════════════╗
    ║  ${model.modelType.toUpperCase()}  ║
    ╠═══════════════════════════════════╣
    ║ Input Shape:  ${JSON.stringify(model.inputShape)}
    ║ Output Shape: ${JSON.stringify(model.outputShape)}
    ║ Parameters:   ${getModelParamCount(model.model)}
    ╚═══════════════════════════════════╝
  `);
}

/**
 * Count model parameters
 */
function getModelParamCount(model: tf.LayersModel): number {
  let totalParams = 0;
  model.weights.forEach((w) => {
    totalParams += w.size;
  });
  return totalParams;
}
