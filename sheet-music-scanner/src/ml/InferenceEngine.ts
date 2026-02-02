/**
 * InferenceEngine - Runs model predictions on preprocessed images
 * Handles batch inference, post-processing, and confidence scoring
 */

import * as tf from '@tensorflow/tfjs';
import { LoadedModel } from './ModelLoader';

export interface PredictionResult {
  classId: number;
  className: string;
  confidence: number;
  allScores: number[];
  timestamp: number;
}

export interface BatchPredictionResult {
  predictions: PredictionResult[];
  batchTime: number;
  perImageTime: number;
}

/**
 * Class mappings for each model
 */
const CLASS_MAPPINGS: Record<string, string[]> = {
  ocr: [
    // 71 music symbol classes
    'Note.WholeNote', 'Note.HalfNote', 'Note.QuarterNote', 'Note.EighthNote',
    'Note.SixteenthNote', 'Rest.WholeRest', 'Rest.HalfRest', 'Rest.QuarterRest',
    'Rest.EighthRest', 'Rest.SixteenthRest', 'Accidental.Flat', 'Accidental.Sharp',
    'Accidental.Natural', 'TimeSignature.Common', 'TimeSignature.Cut',
    'TimeSignature.2_4', 'TimeSignature.3_4', 'TimeSignature.4_4', 'TimeSignature.6_8',
    'Clef.Treble', 'Clef.Bass', 'Clef.Alto', 'Key.CMajor', 'Key.GMajor',
    'Key.DMajor', 'Key.AMajor', 'Key.EMajor', 'Key.BMajor', 'Key.FSharpMajor',
    'Key.CSharpMajor', 'Key.FMajor', 'Key.BbMajor', 'Key.EbMajor', 'Key.AbMajor',
    'Key.DbMajor', 'Key.GbMajor', 'Key.CbMajor', 'Beam.BeamStart', 'Beam.BeamEnd',
    'Beam.BeamContinue', 'Tuplet.Triplet', 'Tuplet.Quintuplet', 'Tuplet.Sextuplet',
    'Dot.Augmentation', 'Dot.Staccato', 'Articulation.Accent', 'Articulation.Marcato',
    'Articulation.Tenuto', 'Ornament.Trill', 'Ornament.Turn', 'Ornament.Mordent',
    'Slur.SlurStart', 'Slur.SlurEnd', 'Slur.TieStart', 'Slur.TieEnd',
    'Dynamic.Pianissimo', 'Dynamic.Piano', 'Dynamic.Mezzo', 'Dynamic.MezzoForte',
    'Dynamic.Forte', 'Dynamic.Fortissimo', 'Crescendo.Start', 'Crescendo.End',
    'Diminuendo.Start', 'Diminuendo.End', 'Pedal.PedalStart', 'Pedal.PedalEnd',
    'Unknown', 'Padding'
  ],
  keySignatureC: [
    'C_Major', 'A_Minor', 'Other'
  ],
  keySignatureDigit: [
    '0_Sharps', '1_Sharp', '2_Sharps', '3_Sharps', '4_Sharps', '5_Sharps',
    '6_Sharps', '7_Sharps', '1_Flat', '2_Flats', '3_Flats'
  ]
};

/**
 * Run inference on a single preprocessed image
 */
export async function predict(
  model: LoadedModel,
  imageTensor: tf.Tensor4D,
  modelType: 'ocr' | 'keySignatureC' | 'keySignatureDigit' = 'ocr'
): Promise<PredictionResult> {
  const startTime = performance.now();

  try {
    // Run prediction
    const outputTensor = model.model.predict(imageTensor) as tf.Tensor2D;
    const scores = await outputTensor.data();

    // Get class mappings
    const classNames = CLASS_MAPPINGS[modelType] || [];

    // Find top prediction
    let maxScore = -Infinity;
    let maxIndex = 0;

    const scoresArray = Array.from(scores);
    for (let i = 0; i < scoresArray.length; i++) {
      if (scoresArray[i] > maxScore) {
        maxScore = scoresArray[i];
        maxIndex = i;
      }
    }

    // Apply softmax if needed (scores should be in [0, 1])
    const normalizedScores = softmax(scoresArray);

    outputTensor.dispose();

    const endTime = performance.now();

    return {
      classId: maxIndex,
      className: classNames[maxIndex] || `Class_${maxIndex}`,
      confidence: normalizedScores[maxIndex],
      allScores: normalizedScores,
      timestamp: endTime - startTime,
    };
  } catch (error) {
    console.error('Inference error:', error);
    throw error;
  }
}

/**
 * Run batch inference on multiple images
 */
export async function batchPredict(
  model: LoadedModel,
  imageTensors: tf.Tensor4D[],
  modelType: 'ocr' | 'keySignatureC' | 'keySignatureDigit' = 'ocr'
): Promise<BatchPredictionResult> {
  const startTime = performance.now();

  try {
    // Stack all tensors into a single batch
    const batchTensor = tf.stack(imageTensors);

    // Run prediction
    const outputTensor = model.model.predict(batchTensor) as tf.Tensor2D;
    const scores = await outputTensor.data();

    // Process results
    const predictions: PredictionResult[] = [];
    const classNames = CLASS_MAPPINGS[modelType] || [];
    const batchSize = imageTensors.length;
    const numClasses = outputTensor.shape[1];

    for (let i = 0; i < batchSize; i++) {
      const start = i * numClasses;
      const end = start + numClasses;
      const classScores = Array.from(scores.slice(start, end));
      const normalizedScores = softmax(classScores);

      let maxScore = -Infinity;
      let maxIndex = 0;
      for (let j = 0; j < normalizedScores.length; j++) {
        if (normalizedScores[j] > maxScore) {
          maxScore = normalizedScores[j];
          maxIndex = j;
        }
      }

      predictions.push({
        classId: maxIndex,
        className: classNames[maxIndex] || `Class_${maxIndex}`,
        confidence: normalizedScores[maxIndex],
        allScores: normalizedScores,
        timestamp: 0,
      });
    }

    batchTensor.dispose();
    outputTensor.dispose();

    const endTime = performance.now();
    const batchTime = endTime - startTime;

    return {
      predictions,
      batchTime,
      perImageTime: batchTime / batchSize,
    };
  } catch (error) {
    console.error('Batch inference error:', error);
    throw error;
  }
}

/**
 * Softmax function - converts logits to probabilities
 */
function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const exps = scores.map(s => Math.exp(s - maxScore));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map(exp => exp / sumExps);
}

/**
 * Get top-k predictions
 */
export function getTopK(
  result: PredictionResult,
  k: number = 5
): { classId: number; className: string; confidence: number }[] {
  return result.allScores
    .map((score, idx) => ({
      classId: idx,
      className: CLASS_MAPPINGS[idx] || `Class_${idx}`,
      confidence: score,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, k);
}

/**
 * Filter predictions by confidence threshold
 */
export function filterByConfidence(
  result: PredictionResult,
  threshold: number = 0.7
): PredictionResult | null {
  if (result.confidence >= threshold) {
    return result;
  }
  return null;
}

/**
 * Run multiple models and aggregate results
 */
export async function multiModelInference(
  models: Record<string, LoadedModel>,
  imageTensor: tf.Tensor4D,
  modelTypeMap: Record<string, 'ocr' | 'keySignatureC' | 'keySignatureDigit'>
): Promise<Record<string, PredictionResult>> {
  const results: Record<string, PredictionResult> = {};

  for (const [modelName, model] of Object.entries(models)) {
    try {
      const modelType = modelTypeMap[modelName] || 'ocr';
      results[modelName] = await predict(model, imageTensor, modelType);
    } catch (error) {
      console.error(`Error in model ${modelName}:`, error);
    }
  }

  return results;
}

/**
 * Analyze prediction uncertainty
 */
export function analyzeUncertainty(result: PredictionResult): {
  entropy: number;
  topK_prob: number;
  isConfident: boolean;
} {
  const { allScores, confidence } = result;

  // Calculate entropy
  const entropy = -allScores.reduce((sum, p) => {
    if (p > 0) {
      sum += p * Math.log2(p);
    }
    return sum;
  }, 0);

  // Top-2 probability difference
  const sorted = [...allScores].sort((a, b) => b - a);
  const topKProb = sorted[0] - (sorted[1] || 0);

  const isConfident = confidence > 0.8 && topKProb > 0.3;

  return { entropy, topK_prob: topKProb, isConfident };
}

/**
 * Debug predictions - useful for model evaluation
 */
export function debugPrediction(
  result: PredictionResult,
  modelType: 'ocr' | 'keySignatureC' | 'keySignatureDigit' = 'ocr'
): string {
  const classNames = CLASS_MAPPINGS[modelType] || [];
  const topK = getTopK(result, 3);
  const uncertainty = analyzeUncertainty(result);

  let debug = `\n=== Prediction Debug ===\n`;
  debug += `Primary: ${result.className} (${(result.confidence * 100).toFixed(2)}%)\n`;
  debug += `Top-3:\n`;
  topK.forEach((pred, idx) => {
    debug += `  ${idx + 1}. ${pred.className}: ${(pred.confidence * 100).toFixed(2)}%\n`;
  });
  debug += `Uncertainty: Entropy=${uncertainty.entropy.toFixed(3)}, TopK_Diff=${uncertainty.topK_prob.toFixed(3)}\n`;
  debug += `Inference time: ${result.timestamp.toFixed(2)}ms\n`;
  debug += `========================\n`;

  return debug;
}
