/**
 * ML Configuration Template
 * Customize this based on your needs
 */

export const ML_CONFIG = {
  // Model file paths
  // Update these if your models are in a different location
  models: {
    ocr: require('../../ocr_model.json'),
    keySignatureC: require('../../keySignatures_c_model.json'),
    keySignatureDigit: require('../../keySignatures_digit_model.json'),
  },

  // Model input/output specifications
  // These match your pre-trained models
  dimensions: {
    ocr: {
      input: { height: 24, width: 24, channels: 1 },
      output: 71, // Number of music symbol classes
    },
    keySignatureC: {
      input: { height: 30, width: 15, channels: 1 },
      output: 3, // C Major, A Minor, Other
    },
    keySignatureDigit: {
      input: { height: 30, width: 27, channels: 1 },
      output: 11, // 0-7 sharps or 1-3 flats
    },
  },

  // Inference parameters
  inference: {
    // Confidence threshold for accepting predictions
    // Range: [0, 1], default: 0.7
    confidenceThreshold: 0.7,

    // Number of top predictions to return
    topKResults: 5,

    // Maximum batch size for batch processing
    batchSize: 10,

    // Timeout for inference (milliseconds)
    // Set to 0 to disable timeout
    inferenceTimeout: 5000,
  },

  // Preprocessing parameters
  preprocessing: {
    // Normalize pixel values
    // true: divide by 255 (converts to [0, 1] range)
    normalize: true,

    // Convert to grayscale
    // Set to true if input is RGB but model expects grayscale
    toGrayscale: true,

    // Augmentation settings (for training/evaluation)
    augmentation: {
      enabled: false,
      flipHorizontal: false,
      flipVertical: false,
      brightnessAdjustment: 0, // Range: [-1.0, 1.0]
    },
  },

  // TensorFlow.js backend configuration
  tensorFlow: {
    // Backend to use
    // Options: 'rn-webgl', 'cpu', 'webgl'
    // Recommended: 'rn-webgl' for React Native (GPU acceleration)
    backend: 'rn-webgl',

    // Enable TensorFlow.js optimizations
    enableOptimizations: true,

    // Memory limit (in MB)
    // Set to 0 for unlimited
    memoryLimit: 512,

    // Enable detailed logging
    verbose: false,
  },

  // Performance tuning
  performance: {
    // Use GPU acceleration if available
    useGPU: true,

    // Maximum number of concurrent inference operations
    maxConcurrentInferences: 3,

    // Enable memory pooling for faster inference
    enableMemoryPooling: true,

    // Target inference time (ms)
    // Used for performance monitoring
    targetInferenceTime: 100,

    // Enable benchmarking
    enableBenchmarking: false,
  },

  // Class mappings for output interpretation
  classNames: {
    ocr: [
      // 71 music symbol classes
      'Note.WholeNote',
      'Note.HalfNote',
      'Note.QuarterNote',
      'Note.EighthNote',
      'Note.SixteenthNote',
      'Rest.WholeRest',
      'Rest.HalfRest',
      'Rest.QuarterRest',
      'Rest.EighthRest',
      'Rest.SixteenthRest',
      'Accidental.Flat',
      'Accidental.Sharp',
      'Accidental.Natural',
      'TimeSignature.Common',
      'TimeSignature.Cut',
      'TimeSignature.2_4',
      'TimeSignature.3_4',
      'TimeSignature.4_4',
      'TimeSignature.6_8',
      'Clef.Treble',
      'Clef.Bass',
      'Clef.Alto',
      'Key.CMajor',
      'Key.GMajor',
      'Key.DMajor',
      'Key.AMajor',
      'Key.EMajor',
      'Key.BMajor',
      'Key.FSharpMajor',
      'Key.CSharpMajor',
      'Key.FMajor',
      'Key.BbMajor',
      'Key.EbMajor',
      'Key.AbMajor',
      'Key.DbMajor',
      'Key.GbMajor',
      'Key.CbMajor',
      'Beam.BeamStart',
      'Beam.BeamEnd',
      'Beam.BeamContinue',
      'Tuplet.Triplet',
      'Tuplet.Quintuplet',
      'Tuplet.Sextuplet',
      'Dot.Augmentation',
      'Dot.Staccato',
      'Articulation.Accent',
      'Articulation.Marcato',
      'Articulation.Tenuto',
      'Ornament.Trill',
      'Ornament.Turn',
      'Ornament.Mordent',
      'Slur.SlurStart',
      'Slur.SlurEnd',
      'Slur.TieStart',
      'Slur.TieEnd',
      'Dynamic.Pianissimo',
      'Dynamic.Piano',
      'Dynamic.Mezzo',
      'Dynamic.MezzoForte',
      'Dynamic.Forte',
      'Dynamic.Fortissimo',
      'Crescendo.Start',
      'Crescendo.End',
      'Diminuendo.Start',
      'Diminuendo.End',
      'Pedal.PedalStart',
      'Pedal.PedalEnd',
      'Unknown',
      'Padding',
    ],

    keySignatureC: [
      'C_Major',
      'A_Minor',
      'Other',
    ],

    keySignatureDigit: [
      '0_Sharps',
      '1_Sharp',
      '2_Sharps',
      '3_Sharps',
      '4_Sharps',
      '5_Sharps',
      '6_Sharps',
      '7_Sharps',
      '1_Flat',
      '2_Flats',
      '3_Flats',
    ],
  },

  // Feature flags for experimental features
  features: {
    // Enable uncertainty quantification
    enableUncertaintyAnalysis: true,

    // Enable attention visualization (if supported)
    enableAttentionViz: false,

    // Enable model distillation
    enableDistillation: false,

    // Enable on-device model adaptation
    enableAdaptation: false,
  },

  // Logging configuration
  logging: {
    enabled: true,
    level: 'info', // 'debug', 'info', 'warn', 'error'
    logToConsole: true,
    logToFile: false,
    maxLogSize: 1000, // Maximum number of log entries to keep
  },

  // Cache configuration
  cache: {
    enabled: true,
    maxSize: 100, // Maximum number of cached predictions
    ttl: 3600000, // Time to live in milliseconds (1 hour)
  },

  // Error handling
  errorHandling: {
    // Retry failed inferences
    retryOnError: true,
    maxRetries: 3,

    // Fallback behavior when inference fails
    fallbackStrategy: 'return_null', // 'return_null', 'return_default', 'throw'

    // Log errors to console
    logErrors: true,
  },
};

/**
 * Development configuration override
 */
export const ML_CONFIG_DEV = {
  ...ML_CONFIG,
  tensorFlow: {
    ...ML_CONFIG.tensorFlow,
    verbose: true,
  },
  logging: {
    ...ML_CONFIG.logging,
    level: 'debug',
  },
  performance: {
    ...ML_CONFIG.performance,
    enableBenchmarking: true,
  },
};

/**
 * Production configuration
 * Optimized for speed and memory efficiency
 */
export const ML_CONFIG_PROD = {
  ...ML_CONFIG,
  inference: {
    ...ML_CONFIG.inference,
    inferenceTimeout: 3000, // Stricter timeout
  },
  tensorFlow: {
    ...ML_CONFIG.tensorFlow,
    verbose: false,
  },
  logging: {
    ...ML_CONFIG.logging,
    level: 'error',
    logToConsole: false,
  },
  performance: {
    ...ML_CONFIG.performance,
    maxConcurrentInferences: 5, // Higher concurrency
    enableBenchmarking: false,
  },
  features: {
    ...ML_CONFIG.features,
    enableAttentionViz: false,
    enableAdaptation: false,
  },
};

/**
 * Get configuration based on environment
 */
export function getMLConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return isDevelopment ? ML_CONFIG_DEV : ML_CONFIG_PROD;
}

export default getMLConfig();
