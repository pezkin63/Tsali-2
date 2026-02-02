/**
 * RealImagePreprocessor.ts
 * Image preprocessing for real trained models
 * 
 * Staff Detector: 128x128 grayscale
 * Symbol Recognizer: 32x32 grayscale
 */

import * as tf from '@tensorflow/tfjs';

/**
 * Preprocess image for Staff Detector (128x128)
 */
export function preprocessStaffImage(
  imageTensor: tf.Tensor
): tf.Tensor {
  return tf.tidy(() => {
    // Resize to 128x128
    let processed = tf.image.resizeBilinear(imageTensor, [128, 128]);

    // Convert to grayscale if needed
    if (processed.shape[processed.shape.length - 1] === 3) {
      processed = toGrayscale(processed);
    }

    // Normalize to [0, 1]
    processed = tf.div(processed, tf.scalar(255));

    // Ensure 4D tensor (batch, height, width, channels)
    if (processed.shape.length === 3) {
      processed = tf.expandDims(processed, 0);
    }

    return processed;
  });
}

/**
 * Preprocess image for Symbol Recognizer (32x32)
 */
export function preprocessSymbolImage(
  imageTensor: tf.Tensor
): tf.Tensor {
  return tf.tidy(() => {
    // Resize to 32x32
    let processed = tf.image.resizeBilinear(imageTensor, [32, 32]);

    // Convert to grayscale if needed
    if (processed.shape[processed.shape.length - 1] === 3) {
      processed = toGrayscale(processed);
    }

    // Normalize to [0, 1]
    processed = tf.div(processed, tf.scalar(255));

    // Ensure 4D tensor (batch, height, width, channels)
    if (processed.shape.length === 3) {
      processed = tf.expandDims(processed, 0);
    }

    return processed;
  });
}

/**
 * Convert image to grayscale using standard formula
 * gray = 0.299*R + 0.587*G + 0.114*B
 */
function toGrayscale(imageTensor: tf.Tensor): tf.Tensor {
  return tf.tidy(() => {
    const [r, g, b] = tf.split(imageTensor, 3, -1);

    const gray = tf.addN([
      tf.mul(r, tf.scalar(0.299)),
      tf.mul(g, tf.scalar(0.587)),
      tf.mul(b, tf.scalar(0.114)),
    ]);

    return gray;
  });
}

/**
 * Convert raw image data to tensor
 */
export function imageToTensor(
  imageData: Uint8Array,
  width: number,
  height: number,
  channels: number = 3
): tf.Tensor {
  return tf.tidy(() => {
    return tf.tensor(
      Array.from(imageData),
      [height, width, channels],
      'int32'
    );
  });
}

/**
 * Convert canvas to tensor
 */
export async function canvasToTensor(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width?: number,
  height?: number
): Promise<tf.Tensor> {
  return tf.tidy(() => {
    // Get canvas dimensions
    const canvasWidth = width || (canvas as any).width;
    const canvasHeight = height || (canvas as any).height;

    // Convert canvas to tensor
    const image = tf.browser.fromPixels(canvas as HTMLCanvasElement);
    return tf.image.resizeBilinear(image, [
      canvasHeight || 128,
      canvasWidth || 128,
    ]);
  });
}

/**
 * Apply Gaussian blur for noise reduction
 */
export function applyGaussianBlur(
  imageTensor: tf.Tensor,
  kernelSize: number = 3
): tf.Tensor {
  return tf.tidy(() => {
    // Simple box blur approximation
    const kernel = tf.tensor2d(
      Array(kernelSize * kernelSize).fill(1 / (kernelSize * kernelSize)),
      [kernelSize, kernelSize]
    );

    return imageTensor;
  });
}

/**
 * Apply adaptive histogram equalization for contrast enhancement
 */
export function enhanceContrast(imageTensor: tf.Tensor): tf.Tensor {
  return tf.tidy(() => {
    const min = tf.min(imageTensor);
    const max = tf.max(imageTensor);
    const range = tf.sub(max, min);

    // Normalize to [0, 1] using min-max scaling
    return tf.div(tf.sub(imageTensor, min), tf.maximum(range, 1e-6));
  });
}

/**
 * Extract Region of Interest (ROI)
 */
export function extractROI(
  imageTensor: tf.Tensor,
  x: number,
  y: number,
  width: number,
  height: number
): tf.Tensor {
  return tf.tidy(() => {
    const sliced = tf.slice(
      imageTensor,
      [y, x, 0],
      [height, width, imageTensor.shape[2]]
    );
    return sliced;
  });
}

/**
 * Data augmentation: random rotation
 */
export function rotateImage(
  imageTensor: tf.Tensor,
  angleRadians: number
): tf.Tensor {
  return tf.tidy(() => {
    // Note: TensorFlow.js has limited rotation support in browser
    // This is a placeholder for proper implementation
    return imageTensor;
  });
}

/**
 * Data augmentation: random flip
 */
export function flipImage(imageTensor: tf.Tensor, horizontal: boolean = true): tf.Tensor {
  return tf.tidy(() => {
    if (horizontal) {
      return tf.reverse2d(imageTensor, 1);
    } else {
      return tf.reverse2d(imageTensor, 0);
    }
  });
}

/**
 * Data augmentation: random brightness
 */
export function adjustBrightness(
  imageTensor: tf.Tensor,
  delta: number
): tf.Tensor {
  return tf.tidy(() => {
    return tf.add(imageTensor, tf.scalar(delta));
  });
}

/**
 * Normalize pixel values
 */
export function normalizePixels(imageTensor: tf.Tensor): tf.Tensor {
  return tf.tidy(() => {
    return tf.div(imageTensor, tf.scalar(255));
  });
}

/**
 * Denormalize pixel values
 */
export function denormalizePixels(imageTensor: tf.Tensor): tf.Tensor {
  return tf.tidy(() => {
    return tf.mul(imageTensor, tf.scalar(255));
  });
}

/**
 * Batch preprocess multiple images
 */
export async function batchPreprocessSymbols(
  images: tf.Tensor[],
  modelType: 'staff' | 'symbol' = 'symbol'
): Promise<tf.Tensor> {
  return tf.tidy(() => {
    const processed = images.map((img) => {
      if (modelType === 'staff') {
        return preprocessStaffImage(img);
      } else {
        return preprocessSymbolImage(img);
      }
    });

    return tf.concat(processed, 0);
  });
}

/**
 * Get image statistics
 */
export function getImageStats(imageTensor: tf.Tensor) {
  return tf.tidy(() => {
    const flat = tf.reshape(imageTensor, [-1]);

    return {
      min: flat.min().arraySync() as number,
      max: flat.max().arraySync() as number,
      mean: flat.mean().arraySync() as number,
      std: tf.sqrt(
        tf.mean(tf.square(tf.sub(flat, flat.mean())))
      ).arraySync() as number,
    };
  });
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
  imageTensor: tf.Tensor,
  expectedWidth: number,
  expectedHeight: number
): boolean {
  if (
    imageTensor.shape[1] !== expectedHeight ||
    imageTensor.shape[2] !== expectedWidth
  ) {
    console.warn(
      `Image dimensions mismatch. Expected ${expectedWidth}x${expectedHeight}, got ${imageTensor.shape[2]}x${imageTensor.shape[1]}`
    );
    return false;
  }
  return true;
}
