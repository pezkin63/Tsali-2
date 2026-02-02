/**
 * ModelLoader - Loads custom JSON format models into TensorFlow.js
 * Handles base64-encoded weights and reconstructs models
 */

import * as tf from '@tensorflow/tfjs';

interface ModelConfig {
  architecture: any;
  trainable_params: Record<string, { bias: string[]; weights: string[] }>;
  input_shapes: number[][];
  output_shapes: number[][];
}

interface LoadedModel {
  model: tf.LayersModel;
  inputShape: number[];
  outputShape: number[];
}

/**
 * Decode base64 string to Float32Array
 */
function base64ToFloat32Array(base64Str: string): Float32Array {
  // Decode base64 to binary string
  const binaryString = atob(base64Str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // Convert to Float32Array
  return new Float32Array(bytes.buffer);
}

/**
 * Apply decoded weights to a layer
 */
function applyWeightsToLayer(
  layer: tf.layers.Layer,
  layerName: string,
  weights: string[],
  biases: string[]
): void {
  const weightArrays: tf.Tensor[] = [];

  // Process kernel weights
  if (weights.length > 0) {
    const kernelData = base64ToFloat32Array(weights[0]);
    const kernelShape = getWeightShape(layer, 'kernel');
    if (kernelShape) {
      const kernel = tf.tensor(kernelData, kernelShape, 'float32');
      weightArrays.push(kernel);
    }
  }

  // Process biases
  if (biases.length > 0) {
    const biasData = base64ToFloat32Array(biases[0]);
    const biasShape = getWeightShape(layer, 'bias');
    if (biasShape) {
      const bias = tf.tensor(biasData, biasShape, 'float32');
      weightArrays.push(bias);
    }
  }

  // Apply weights to layer
  if (weightArrays.length > 0) {
    try {
      layer.setWeights(weightArrays);
    } catch (error) {
      console.warn(`Failed to set weights for layer ${layerName}:`, error);
    }
  }

  // Clean up tensors
  weightArrays.forEach(tensor => tensor.dispose());
}

/**
 * Infer weight shape from layer configuration
 */
function getWeightShape(layer: tf.layers.Layer, weightType: 'kernel' | 'bias'): number[] | null {
  const config = (layer as any).getConfig?.();
  if (!config) return null;

  if (weightType === 'kernel') {
    if (config.kernel_size) {
      // Conv2D layer
      const filters = config.filters;
      const [kernelH, kernelW] = config.kernel_size;
      const channels = config.batch_input_shape?.[3] || 1;
      return [kernelH, kernelW, channels, filters];
    }
    if (config.units) {
      // Dense layer
      return [config.input_shape?.[1] || config.units, config.units];
    }
  } else if (weightType === 'bias') {
    if (config.units) {
      return [config.units];
    }
    if (config.filters) {
      return [config.filters];
    }
  }

  return null;
}

/**
 * Create a functional model from the architecture JSON
 */
function createModelFromArchitecture(
  architecture: any,
  weights: Record<string, { bias: string[]; weights: string[] }>
): tf.LayersModel {
  const { layers: layerConfigs, input_layers: inputLayers, output_layers: outputLayers } = architecture.config;

  const layerMap: Record<string, tf.SymbolicTensor | tf.layers.Layer> = {};
  let currentInput: tf.SymbolicTensor | tf.layers.Layer | null = null;

  // Create all layers
  for (const layerConfig of layerConfigs) {
    const { class_name, name, config } = layerConfig;

    let layer: tf.layers.Layer;

    try {
      switch (class_name) {
        case 'InputLayer':
          const inputShape = config.batch_input_shape.slice(1);
          layer = tf.input({ shape: inputShape, name });
          break;

        case 'Conv2D':
          layer = tf.layers.conv2d({
            filters: config.filters,
            kernelSize: config.kernel_size,
            strides: config.strides,
            padding: config.padding,
            activation: config.activation,
            name,
          });
          break;

        case 'MaxPooling2D':
          layer = tf.layers.maxPooling2d({
            poolSize: config.pool_size,
            strides: config.strides,
            padding: config.padding,
            name,
          });
          break;

        case 'Flatten':
          layer = tf.layers.flatten({ name });
          break;

        case 'Dense':
          layer = tf.layers.dense({
            units: config.units,
            activation: config.activation,
            name,
          });
          break;

        default:
          console.warn(`Unsupported layer type: ${class_name}`);
          continue;
      }

      layerMap[name] = layer;

      // Apply weights if available
      if (weights[name]) {
        applyWeightsToLayer(layer, name, weights[name].weights, weights[name].bias);
      }
    } catch (error) {
      console.error(`Failed to create layer ${name}:`, error);
    }
  }

  // Connect layers
  for (const layerConfig of layerConfigs) {
    const { name, inbound_nodes } = layerConfig;
    const layer = layerMap[name];

    if (!inbound_nodes || inbound_nodes.length === 0) continue;

    for (const nodeConfig of inbound_nodes) {
      const [[inputName]] = nodeConfig;
      const inputLayer = layerMap[inputName];

      if (inputLayer && layer instanceof tf.layers.Layer) {
        try {
          if (inputLayer instanceof tf.SymbolicTensor) {
            const output = layer.apply(inputLayer) as tf.SymbolicTensor;
            layerMap[name] = output;
          }
        } catch (error) {
          console.warn(`Failed to connect ${inputName} -> ${name}:`, error);
        }
      }
    }
  }

  // Build model from input to output
  const inputName = inputLayers[0][0];
  const outputName = outputLayers[0][0];

  const inputs = layerMap[inputName] as tf.SymbolicTensor;
  const outputs = layerMap[outputName] as tf.SymbolicTensor;

  if (!inputs || !outputs) {
    throw new Error('Could not create model: missing inputs or outputs');
  }

  return tf.model({ inputs, outputs });
}

/**
 * Load a model from custom JSON format
 */
export async function loadCustomModel(jsonPath: string): Promise<LoadedModel> {
  try {
    const response = await fetch(jsonPath);
    const modelConfig: ModelConfig = await response.json();

    const model = createModelFromArchitecture(
      modelConfig.architecture,
      modelConfig.trainable_params
    );

    return {
      model,
      inputShape: modelConfig.input_shapes[0],
      outputShape: modelConfig.output_shapes[0],
    };
  } catch (error) {
    console.error('Failed to load model:', error);
    throw error;
  }
}

/**
 * Batch load multiple models
 */
export async function loadMultipleModels(
  paths: Record<string, string>
): Promise<Record<string, LoadedModel>> {
  const models: Record<string, LoadedModel> = {};

  const loadPromises = Object.entries(paths).map(async ([key, path]) => {
    try {
      models[key] = await loadCustomModel(path);
    } catch (error) {
      console.error(`Failed to load model ${key}:`, error);
    }
  });

  await Promise.all(loadPromises);
  return models;
}

/**
 * Dispose of a model to free memory
 */
export function disposeModel(loadedModel: LoadedModel): void {
  if (loadedModel.model) {
    loadedModel.model.dispose();
  }
}

/**
 * Get model info (debugging)
 */
export function getModelInfo(loadedModel: LoadedModel): {
  inputShape: number[];
  outputShape: number[];
  paramCount: number;
} {
  const weights = loadedModel.model.getWeights();
  let paramCount = 0;

  weights.forEach(weight => {
    const size = weight.size;
    paramCount += size;
    weight.dispose();
  });

  return {
    inputShape: loadedModel.inputShape,
    outputShape: loadedModel.outputShape,
    paramCount,
  };
}
