/**
 * ImagePreprocessor - Prepares camera images for model inference
 * Handles resizing, normalization, and tensor conversion
 */

import * as tf from '@tensorflow/tfjs';
import { Image } from 'react-native-image-crop-picker';

export interface PreprocessedImage {
  tensor: tf.Tensor4D;
  width: number;
  height: number;
}

/**
 * Resize image to target dimensions
 * Maintains aspect ratio with padding if needed
 */
export function resizeImage(
  imageData: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  channels: number = 3
): PreprocessedImage {
  // Create canvas for resizing (in React Native, use native image processing)
  const tensor = tf.tensor4d(imageData, [sourceHeight, sourceWidth, channels], 'uint8');

  // Resize using tf.image.resizeBilinear
  const resized = tf.image.resizeBilinear(
    tensor.expandDims(0) as tf.Tensor4D,
    [targetHeight, targetWidth]
  ).squeeze([0]) as tf.Tensor3D;

  // Dispose original
  tensor.dispose();

  // Convert to batch tensor (add batch dimension)
  const batched = resized.expandDims(0) as tf.Tensor4D;

  return {
    tensor: batched,
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * Convert image to grayscale (for single channel models)
 */
export function toGrayscale(imageTensor: tf.Tensor3D): tf.Tensor3D {
  if (imageTensor.shape[2] === 1) {
    return imageTensor; // Already grayscale
  }

  // Use luminosity method: 0.299*R + 0.587*G + 0.114*B
  return tf.tidy(() => {
    const [r, g, b] = tf.unstack(imageTensor, 2);
    const gray = tf.add(
      tf.add(
        tf.mul(r, 0.299),
        tf.mul(g, 0.587)
      ),
      tf.mul(b, 0.114)
    );
    return gray.expandDims(2);
  });
}

/**
 * Normalize pixel values to [0, 1] range
 */
export function normalizePixels(imageTensor: tf.Tensor4D): tf.Tensor4D {
  return tf.tidy(() => {
    return tf.div(imageTensor, 255.0) as tf.Tensor4D;
  });
}

/**
 * Standardize image (zero mean, unit variance)
 * Using ImageNet statistics
 */
export function standardizeImage(imageTensor: tf.Tensor4D): tf.Tensor4D {
  return tf.tidy(() => {
    // ImageNet mean and std
    const mean = tf.tensor1d([0.485, 0.456, 0.406]);
    const std = tf.tensor1d([0.229, 0.224, 0.225]);

    // Normalize to [0, 1]
    let normalized = tf.div(imageTensor, 255.0);

    // Apply standardization
    normalized = tf.sub(normalized, mean);
    normalized = tf.div(normalized, std);

    return normalized as tf.Tensor4D;
  });
}

/**
 * Main preprocessing pipeline for OCR model (24x24 input)
 */
export function preprocessOCRImage(
  imageTensor: tf.Tensor3D,
  targetSize: number = 24
): tf.Tensor4D {
  return tf.tidy(() => {
    // Convert to grayscale
    let processed = toGrayscale(imageTensor);

    // Resize
    const resized = tf.image.resizeBilinear(
      processed.expandDims(0) as tf.Tensor4D,
      [targetSize, targetSize]
    );

    // Normalize to [0, 1]
    const normalized = tf.div(resized, 255.0) as tf.Tensor4D;

    return normalized;
  });
}

/**
 * Preprocessing pipeline for key signature model (30x15 input)
 */
export function preprocessKeySignatureC(
  imageTensor: tf.Tensor3D
): tf.Tensor4D {
  return tf.tidy(() => {
    // Convert to grayscale
    let processed = toGrayscale(imageTensor);

    // Resize to 30x15
    const resized = tf.image.resizeBilinear(
      processed.expandDims(0) as tf.Tensor4D,
      [30, 15]
    );

    // Normalize
    const normalized = tf.div(resized, 255.0) as tf.Tensor4D;

    return normalized;
  });
}

/**
 * Preprocessing pipeline for digit model (30x27 input)
 */
export function preprocessKeySignatureDigit(
  imageTensor: tf.Tensor3D
): tf.Tensor4D {
  return tf.tidy(() => {
    // Convert to grayscale
    let processed = toGrayscale(imageTensor);

    // Resize to 30x27
    const resized = tf.image.resizeBilinear(
      processed.expandDims(0) as tf.Tensor4D,
      [30, 27]
    );

    // Normalize
    const normalized = tf.div(resized, 255.0) as tf.Tensor4D;

    return normalized;
  });
}

/**
 * Convert raw image data (from camera or file) to tensor
 */
export function imageToTensor(
  imageData: Uint8Array,
  width: number,
  height: number,
  channels: number = 3
): tf.Tensor3D {
  return tf.tensor3d(imageData, [height, width, channels], 'uint8');
}

/**
 * Apply data augmentation (for training/evaluation)
 */
export function augmentImage(
  imageTensor: tf.Tensor4D,
  options: {
    flipHorizontal?: boolean;
    flipVertical?: boolean;
    rotationDegrees?: number;
    brightnessAdjustment?: number; // -1.0 to 1.0
  } = {}
): tf.Tensor4D {
  return tf.tidy(() => {
    let augmented = imageTensor;

    // Horizontal flip
    if (options.flipHorizontal) {
      augmented = tf.image.flipLeftRight(augmented);
    }

    // Vertical flip
    if (options.flipVertical) {
      augmented = tf.image.flipUpDown(augmented);
    }

    // Brightness adjustment
    if (options.brightnessAdjustment !== undefined) {
      augmented = tf.image.adjustBrightness(augmented, options.brightnessAdjustment);
    }

    return augmented;
  });
}

/**
 * Extract ROI (region of interest) from image
 */
export function extractROI(
  imageTensor: tf.Tensor3D,
  x: number,
  y: number,
  width: number,
  height: number
): tf.Tensor3D {
  return tf.tidy(() => {
    // Ensure coordinates are within bounds
    const [imageHeight, imageWidth] = imageTensor.shape;
    const x0 = Math.max(0, Math.min(x, imageWidth - 1));
    const y0 = Math.max(0, Math.min(y, imageHeight - 1));
    const x1 = Math.max(0, Math.min(x + width, imageWidth));
    const y1 = Math.max(0, Math.min(y + height, imageHeight));

    // Slice the ROI
    return tf.slice(imageTensor, [y0, x0, 0], [y1 - y0, x1 - x0, -1]);
  });
}

/**
 * Dispose tensor to free memory
 */
export function disposeTensor(tensor: tf.Tensor): void {
  if (tensor) {
    tensor.dispose();
  }
}

/**
 * Get tensor statistics for debugging
 */
export function getTensorStats(tensor: tf.Tensor): {
  min: number;
  max: number;
  mean: number;
  std: number;
  shape: number[];
} {
  return tf.tidy(() => {
    return {
      min: tensor.min().dataSync()[0],
      max: tensor.max().dataSync()[0],
      mean: tensor.mean().dataSync()[0],
      std: tensor.sqrt(tensor.variance()).dataSync()[0],
      shape: tensor.shape,
    };
  });
}
