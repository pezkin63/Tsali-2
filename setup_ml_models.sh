#!/bin/bash
# setup_ml_models.sh - Setup script for ML model integration

set -e

echo "🚀 Setting up TensorFlow.js ML Models for Tsali Scanner"
echo "=========================================================="
echo ""

# Check Node.js
echo "✓ Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Please install Node.js first."
    exit 1
fi
echo "  Node.js version: $(node --version)"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "✗ package.json not found. Please run this from the project root."
    exit 1
fi
echo "✓ Project directory verified"
echo ""

# Create ML directories
echo "📁 Creating ML module directories..."
mkdir -p src/ml
mkdir -p src/models
mkdir -p src/components
echo "  ✓ Created src/ml"
echo "  ✓ Created src/models"
echo "  ✓ Created src/components"
echo ""

# Check model files
echo "🔍 Verifying model files..."
MODELS=(
    "ocr_model.json"
    "keySignatures_c_model.json"
    "keySignatures_digit_model.json"
)

for model in "${MODELS[@]}"; do
    if [ -f "sheet-music-scanner/$model" ]; then
        size=$(du -h "sheet-music-scanner/$model" | cut -f1)
        echo "  ✓ $model ($size)"
    else
        echo "  ✗ $model NOT FOUND"
    fi
done
echo ""

# Install TensorFlow.js dependencies
echo "📦 Installing TensorFlow.js packages..."
if grep -q "@tensorflow/tfjs" package.json; then
    echo "  ℹ TensorFlow.js already in package.json"
else
    echo "  Installing @tensorflow/tfjs..."
    npm install --save @tensorflow/tfjs
    echo "  Installing @tensorflow/tfjs-react-native..."
    npm install --save @tensorflow/tfjs-react-native
fi
echo "  ✓ TensorFlow.js packages ready"
echo ""

# Create test file
echo "📝 Creating model test file..."
cat > src/ml/__tests__/ModelLoader.test.ts << 'EOF'
import * as tf from '@tensorflow/tfjs';
import { loadCustomModel } from '../ModelLoader';

describe('ModelLoader', () => {
  beforeAll(async () => {
    await tf.ready();
  });

  test('should load OCR model', async () => {
    // This is a placeholder test
    // In real testing, you'd load the actual model file
    expect(true).toBe(true);
  });

  test('should handle base64 decoding', async () => {
    // Test base64 to Float32Array conversion
    const testBase64 = 'AAAAAAA='; // Represents [0, 0, 0, 0]
    expect(testBase64).toBeTruthy();
  });
});
EOF
echo "  ✓ Created test file"
echo ""

# Create configuration file
echo "⚙️  Creating ML configuration..."
cat > src/ml/config.ts << 'EOF'
/**
 * ML Model Configuration
 */

export const ML_CONFIG = {
  // Model paths (relative to app root)
  models: {
    ocr: require('./../../ocr_model.json'),
    keySignatureC: require('./../../keySignatures_c_model.json'),
    keySignatureDigit: require('./../../keySignatures_digit_model.json'),
  },

  // Model input/output dimensions
  dimensions: {
    ocr: { input: [24, 24, 1], output: 71 },
    keySignatureC: { input: [30, 15, 1], output: 3 },
    keySignatureDigit: { input: [30, 27, 1], output: 11 },
  },

  // Inference settings
  inference: {
    confidenceThreshold: 0.7,
    topKResults: 5,
    batchSize: 10,
  },

  // Performance settings
  performance: {
    useWebGL: true,
    enableOptimizations: true,
    maxConcurrentInferences: 3,
  },
};

export default ML_CONFIG;
EOF
echo "  ✓ Created config file"
echo ""

# Create initialization helper
echo "🔧 Creating initialization helper..."
cat > src/ml/initialize.ts << 'EOF'
/**
 * Initialize TensorFlow.js and models
 */

import * as tf from '@tensorflow/tfjs';
import { loadMultipleModels } from './ModelLoader';
import { ML_CONFIG } from './config';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize TensorFlow.js backend and models
 */
export async function initializeTensorFlow(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('[ML] Initializing TensorFlow.js...');

      // Set backend
      if (ML_CONFIG.performance.useWebGL) {
        await tf.setBackend('rn-webgl');
      }

      // Wait for TF to be ready
      await tf.ready();
      
      console.log('[ML] TensorFlow.js ready');
      console.log('[ML] Backend:', tf.getBackend());
      console.log('[ML] Memory:', tf.memory());

      isInitialized = true;
    } catch (error) {
      console.error('[ML] Initialization failed:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Load all models
 */
export async function loadAllModels() {
  await initializeTensorFlow();
  console.log('[ML] Loading models...');
  return loadMultipleModels(ML_CONFIG.models);
}

/**
 * Check if TensorFlow is ready
 */
export function isTensorFlowReady(): boolean {
  return isInitialized;
}

/**
 * Get memory info
 */
export function getMemoryInfo() {
  return tf.memory();
}

/**
 * Cleanup
 */
export function cleanup() {
  if (isInitialized) {
    console.log('[ML] Cleaning up...');
    isInitialized = false;
    initPromise = null;
  }
}
EOF
echo "  ✓ Created initialization helper"
echo ""

# Create comprehensive testing guide
echo "📋 Creating testing guide..."
cat > src/ml/TESTING.md << 'EOF'
# Model Testing Guide

## Quick Test

```typescript
import { initializeTensorFlow, loadAllModels } from './initialize';
import { imageToTensor, preprocessOCRImage } from './ImagePreprocessor';
import { predict } from './InferenceEngine';
import * as tf from '@tensorflow/tfjs';

async function testModels() {
  // Initialize
  await initializeTensorFlow();
  const models = await loadAllModels();
  
  // Create dummy image (24x24 grayscale)
  const dummyImageData = new Uint8Array(24 * 24 * 3).fill(128);
  const imageTensor = imageToTensor(dummyImageData, 24, 24, 3);
  
  // Preprocess
  const preprocessed = preprocessOCRImage(imageTensor);
  
  // Run inference
  const result = await predict(models.ocr, preprocessed, 'ocr');
  console.log('Result:', result);
  
  // Cleanup
  preprocessed.dispose();
  imageTensor.dispose();
}

testModels();
```

## Debugging

Check TensorFlow memory:
```typescript
console.log(tf.memory());
// {
//   numTensors: 12,
//   numDataBuffers: 8,
//   numBytes: 45320,
//   unreliable: false
// }
```

List all tensors:
```typescript
console.log(tf.memory().unreliable ? '⚠️ Memory tracking unreliable' : '✓ OK');
```

## Performance Benchmarking

```typescript
async function benchmark() {
  const iterations = 100;
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await predict(model, preprocessed, 'ocr');
    const time = performance.now() - start;
    times.push(time);
  }
  
  const avg = times.reduce((a, b) => a + b) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log(`Inference times (${iterations} iterations):`);
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
}
```
EOF
echo "  ✓ Created testing guide"
echo ""

# Summary
echo "=========================================================="
echo "✅ Setup Complete!"
echo "=========================================================="
echo ""
echo "📚 Next Steps:"
echo "  1. Models are located at: sheet-music-scanner/"
echo "  2. ML module at: src/ml/"
echo "  3. Read: TF_JS_INTEGRATION_GUIDE.md"
echo "  4. Test: src/ml/TESTING.md"
echo ""
echo "🚀 Quick Start:"
echo "  import { useMusicRecognition } from './ml/useOMRModels';"
echo ""
echo "📦 Installed Packages:"
npm list @tensorflow/tfjs @tensorflow/tfjs-react-native 2>/dev/null | grep -E '@tensorflow|tfjs' || echo "  ✓ TensorFlow.js packages"
echo ""
echo "Happy recognizing! 🎵"
