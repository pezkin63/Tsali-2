# TensorFlow.js Model Integration Guide for Tsali Scanner

This guide explains how to use the pre-trained OMR (Optical Music Recognition) models in your React Native app.

## Overview

Your app includes three pre-trained TensorFlow.js models:

1. **ocr_model.json** - Music symbol recognition (24×24 input, 71 classes)
2. **keySignatures_c_model.json** - Key signature detection (30×15 input, 3 classes)
3. **keySignatures_digit_model.json** - Sharp/flat count (30×27 input, 11 classes)

All models are in a custom JSON format with base64-encoded weights that have been decoded and tested.

## Architecture

### File Structure

```
src/ml/
├── ModelLoader.ts           # Loads custom JSON models → TensorFlow.js
├── ImagePreprocessor.ts     # Image preprocessing pipeline
├── InferenceEngine.ts       # Model inference and post-processing
└── useOMRModels.ts          # React hooks for easy integration
src/components/
└── SymbolRecognizer.tsx     # Example usage component
```

### Model Architecture (All 3 Similar)

```
Input Layer (batch, height, width, channels)
    ↓
Conv2D (5×5, 16 filters) + ReLU
    ↓
MaxPooling2D (2×2)
    ↓
Conv2D (2×2, 8 filters) + ReLU
    ↓
MaxPooling2D (2×2)
    ↓
Flatten
    ↓
Dense (280 units) + ReLU
    ↓
Dense (140 units) + ReLU
    ↓
Dense (output_size) + Softmax
    ↓
Output Layer (predictions)
```

## Installation

### 1. Install Dependencies

```bash
npm install --save @tensorflow/tfjs @tensorflow/tfjs-react-native
# or with expo
expo install @tensorflow/tfjs @tensorflow/tfjs-react-native
```

### 2. Set Up Backend

The models use the RN WebGL backend for performance. This is auto-configured in `useOMRModels.ts`.

### 3. Add Model Files

Place your model JSON files in the assets:
```
sheet-music-scanner/
├── ocr_model.json
├── keySignatures_c_model.json
├── keySignatures_digit_model.json
```

## Usage

### Basic Usage with React Hook

```tsx
import { useMusicRecognition } from './ml/useOMRModels';
import * as tf from '@tensorflow/tfjs';

function MyComponent() {
  const recognition = useMusicRecognition({
    ocrModelPath: require('./ocr_model.json'),
    keySignatureCPath: require('./keySignatures_c_model.json'),
    keySignatureDigitPath: require('./keySignatures_digit_model.json'),
  });

  // Wait for models to load
  if (recognition.isLoading) {
    return <Text>Loading models...</Text>;
  }

  if (recognition.error) {
    return <Text>Error: {recognition.error}</Text>;
  }

  // Use the models
  const handleRecognize = async (imageData: Uint8Array, width: number, height: number) => {
    try {
      const result = await recognition.recognizeSymbol(imageData, width, height);
      console.log('Recognized:', result.className, result.confidence);
    } catch (error) {
      console.error('Recognition failed:', error);
    }
  };

  return (
    // Your component JSX
  );
}
```

### Low-Level API Usage

For more control, use the individual modules:

```tsx
import { loadCustomModel } from './ml/ModelLoader';
import { preprocessOCRImage, imageToTensor } from './ml/ImagePreprocessor';
import { predict } from './ml/InferenceEngine';
import * as tf from '@tensorflow/tfjs';

// Load a single model
const loadedModel = await loadCustomModel('./ocr_model.json');

// Convert image to tensor
const imageData = new Uint8Array(24 * 24 * 3); // Your image data
const imageTensor = imageToTensor(imageData, 24, 24, 3);

// Preprocess
const preprocessed = preprocessOCRImage(imageTensor);

// Run inference
const result = await predict(loadedModel, preprocessed, 'ocr');
console.log('Result:', result);

// Clean up
preprocessed.dispose();
imageTensor.dispose();
```

## API Reference

### ModelLoader.ts

#### `loadCustomModel(jsonPath: string): Promise<LoadedModel>`
Loads a single model from JSON file.

**Parameters:**
- `jsonPath`: Path to model JSON file

**Returns:** Promise resolving to `LoadedModel` with model, inputShape, outputShape

**Example:**
```typescript
const model = await loadCustomModel('./ocr_model.json');
console.log(model.inputShape); // [24, 24, 1]
```

#### `loadMultipleModels(paths: Record<string, string>): Promise<Record<string, LoadedModel>>`
Batch load multiple models.

**Example:**
```typescript
const models = await loadMultipleModels({
  ocr: './ocr_model.json',
  keyC: './keySignatures_c_model.json',
});
```

### ImagePreprocessor.ts

#### `preprocessOCRImage(imageTensor: tf.Tensor3D, targetSize?: number): tf.Tensor4D`
Prepare image for OCR model (24×24).

**Preprocessing steps:**
1. Convert to grayscale
2. Resize to 24×24
3. Normalize to [0, 1]

#### `preprocessKeySignatureC(imageTensor: tf.Tensor3D): tf.Tensor4D`
Prepare image for key signature C model (30×15).

#### `preprocessKeySignatureDigit(imageTensor: tf.Tensor3D): tf.Tensor4D`
Prepare image for digit model (30×27).

#### `imageToTensor(imageData: Uint8Array, width: number, height: number, channels?: number): tf.Tensor3D`
Convert raw image data to tensor.

### InferenceEngine.ts

#### `predict(model: LoadedModel, imageTensor: tf.Tensor4D, modelType: string): Promise<PredictionResult>`
Run inference on a single image.

**Returns:**
```typescript
{
  classId: number;           // Predicted class ID
  className: string;         // Predicted class name
  confidence: number;        // Confidence [0, 1]
  allScores: number[];      // All class scores
  timestamp: number;        // Inference time (ms)
}
```

#### `batchPredict(model: LoadedModel, imageTensors: tf.Tensor4D[], modelType: string): Promise<BatchPredictionResult>`
Run inference on multiple images at once.

**Returns:**
```typescript
{
  predictions: PredictionResult[];
  batchTime: number;        // Total time
  perImageTime: number;     // Average per image
}
```

#### `getTopK(result: PredictionResult, k?: number): Array<{classId, className, confidence}>`
Get top-K predictions.

### useOMRModels.ts (React Hook)

#### `useMusicRecognition(config: OMRModelsConfig): UseOMRModelsReturn`

**Returns:**
- `isLoading: boolean` - Models loading
- `error: string | null` - Error message if any
- `modelsLoaded: boolean` - All models ready
- `isProcessing: boolean` - Inference in progress
- `results: {...}` - Latest recognition results
- `recognizeSymbol(imageData, width, height)` - Recognize music symbol
- `recognizeKeySignature(imageData, width, height)` - Recognize key signature
- `getModelInfo()` - Get model metadata
- `cleanup()` - Free resources

## Image Input Format

Models expect preprocessed images as Float32 tensors with values in [0, 1] range.

### Input Shapes

| Model | Input Shape | Channels | Data Type |
|-------|------------|----------|-----------|
| OCR | [24, 24] | 1 (grayscale) | Float32 [0,1] |
| Key C | [30, 15] | 1 (grayscale) | Float32 [0,1] |
| Key Digit | [30, 27] | 1 (grayscale) | Float32 [0,1] |

### Getting Image Data from Camera

```typescript
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { RNCamera } from 'react-native-camera';
import RNFS from 'react-native-fs';

// From camera capture
async function getCameraImageData() {
  // After capturing with camera...
  const imageUri = photo.uri;
  
  // Read file as base64
  const base64 = await RNFS.readFile(imageUri, 'base64');
  
  // Decode to Uint8Array
  const binaryString = atob(base64);
  const imageData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    imageData[i] = binaryString.charCodeAt(i);
  }
  
  return { imageData, width: 1920, height: 1080 };
}
```

## Memory Management

Always dispose tensors to prevent memory leaks:

```typescript
const result = tf.tidy(() => {
  const tensor = tf.tensor(...);
  // Do work
  return output; // Only this is returned, others auto-disposed
});

// Or manually
tensor.dispose();
imageTensor.dispose();
```

## Performance Optimization

### 1. Batch Processing
Process multiple images at once:
```typescript
const results = await recognition.predictBatchSymbols([img1, img2, img3]);
```

### 2. WebGL Backend
Models use RN WebGL by default (faster than CPU).

### 3. Memory Limits
- OCR model: ~131K parameters
- Key C model: ~88K parameters  
- Digit model: ~136K parameters
- Total: ~355K parameters (~1.4 MB in memory)

### 4. Inference Times
Typical times on modern Android/iOS devices:
- Single prediction: 50-150ms
- Batch of 10: 200-400ms

## Debugging

### Enable Debug Output
```typescript
import { debugPrediction } from './ml/InferenceEngine';

const result = await predict(model, tensor, 'ocr');
console.log(debugPrediction(result, 'ocr'));
```

### Get Model Statistics
```typescript
const info = recognition.getModelInfo();
console.log(info);
// {
//   ocr: { inputShape: [24,24,1], outputShape: [71], parameters: 131000 },
//   ...
// }
```

### Uncertainty Analysis
```typescript
import { analyzeUncertainty } from './ml/InferenceEngine';

const uncertainty = analyzeUncertainty(result);
console.log(uncertainty);
// { entropy: 2.34, topK_prob: 0.45, isConfident: true }
```

## Class Mappings

### OCR Model (71 Classes)
- Note types (whole, half, quarter, eighth, sixteenth)
- Rest types (whole, half, quarter, eighth, sixteenth)
- Accidentals (flat, sharp, natural)
- Time signatures (common, cut, 2/4, 3/4, 4/4, 6/8)
- Clefs (treble, bass, alto)
- Key signatures (major keys)
- Beams, tuplets, dots
- Articulations, ornaments
- Dynamics, pedal markings
- Plus padding and unknown

### Key Signature C (3 Classes)
- C Major (0 sharps/flats)
- A Minor (0 sharps/flats)
- Other

### Digit Model (11 Classes)
- 0 sharps: C major / A minor
- 1-7 sharps: G, D, A, E, B, F#, C# major
- 1-3 flats: F, Bb, Eb major
- More flats: Ab, Db, Gb, Cb major

## Troubleshooting

### Models Fail to Load
**Issue:** `Cannot find model file`

**Solution:**
```typescript
// Use require() for bundled assets
const model = await loadCustomModel(require('./ocr_model.json'));

// Or use absolute path
const model = await loadCustomModel('file:///android_asset/ocr_model.json');
```

### Out of Memory
**Issue:** App crashes during inference

**Solution:**
- Dispose tensors immediately after use
- Use batch processing for multiple images
- Reduce image resolution before preprocessing
- Monitor memory with `tf.memory()`

```typescript
console.log(tf.memory());
// { numTensors: 5, numDataBuffers: 3, numBytes: 12400, ... }
```

### Poor Recognition Accuracy
**Issue:** Wrong predictions

**Solution:**
- Check image preprocessing (grayscale conversion, normalization)
- Ensure image quality and contrast
- Verify input dimensions match model expectations
- Check confidence scores - low confidence means uncertainty

## Next Steps

1. **Integrate with Camera:** Connect to device camera for real-time recognition
2. **Implement Batch Processing:** Process multiple staff lines in parallel
3. **Build Music Composition:** Convert recognized symbols to MIDI/audio
4. **Add User Feedback:** Allow users to correct misrecognitions
5. **Quantization:** Convert models to int8 for faster inference
6. **Custom Training:** Fine-tune models on your specific music notation style

## Related Documentation

- [TensorFlow.js Documentation](https://js.tensorflow.org/)
- [TensorFlow.js React Native Guide](https://github.com/tensorflow/tfjs/tree/master/tfjs-react-native)
- [React Native Camera Integration](https://react-native-camera.github.io/)

## Support

For issues or questions:
1. Check TensorFlow.js GitHub: https://github.com/tensorflow/tfjs
2. React Native community: https://github.com/react-native-community
3. Tsali project repository
