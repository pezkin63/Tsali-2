/**
 * Embedded Model Loader Service
 * 
 * Loads Keras models with embedded weights from JSON files.
 * These JSON files contain both architecture and pre-trained weights.
 * 
 * Models included:
 * - keySignatures_c_model.json - Detects C major key signature
 * - keySignatures_digit_model.json - Detects digit in key signature
 * - ocr_model.json - Optical character recognition for musical symbols
 */

import * as tf from '@tensorflow/tfjs';

export interface EmbeddedModel {
  name: string;
  loadedModel: tf.LayersModel | null;
  inputShape: number[];
  outputShape: number[];
  isLoaded: boolean;
}

/**
 * Embedded Model Loader - manages loading and inference with embedded models
 */
export class EmbeddedModelLoader {
  private static instance: EmbeddedModelLoader;
  private models: Map<string, EmbeddedModel> = new Map();
  private modelConfigs: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): EmbeddedModelLoader {
    if (!EmbeddedModelLoader.instance) {
      EmbeddedModelLoader.instance = new EmbeddedModelLoader();
    }
    return EmbeddedModelLoader.instance;
  }

  /**
   * Initialize TensorFlow.js
   */
  async initialize(): Promise<void> {
    try {
      // Load backend if available
      await tf.ready();
      console.log('✅ TensorFlow.js initialized');
    } catch (error) {
      console.warn('⚠️ TensorFlow.js initialization issue:', error);
    }
  }

  /**
   * Load embedded model from JSON configuration
   * 
   * @param modelName - Unique identifier for the model
   * @param modelJson - The JSON object containing model architecture and weights
   */
  async loadEmbeddedModel(
    modelName: string,
    modelJson: any
  ): Promise<EmbeddedModel> {
    try {
      console.log(`📦 Loading embedded model: ${modelName}`);

      // Initialize TF if needed
      if (!tf.ready) {
        await this.initialize();
      }

      // Extract architecture from JSON
      const architecture = modelJson.architecture || modelJson;
      
      // Create model from JSON
      const model = await tf.models.modelFromJSON({
        modelTopology: architecture,
        weightsManifest: []
      });

      // Get input/output shapes
      const inputShape = (model.inputs[0].shape as number[]).slice(1); // Remove batch dimension
      const outputShape = (model.outputs[0].shape as number[]).slice(1);

      const embeddedModel: EmbeddedModel = {
        name: modelName,
        loadedModel: model,
        inputShape,
        outputShape,
        isLoaded: true
      };

      this.models.set(modelName, embeddedModel);
      this.modelConfigs.set(modelName, modelJson);

      console.log(`✅ Loaded ${modelName}`);
      console.log(`   Input shape: ${inputShape}`);
      console.log(`   Output shape: ${outputShape}`);

      return embeddedModel;
    } catch (error) {
      console.error(`❌ Failed to load model ${modelName}:`, error);
      throw new Error(`Failed to load embedded model: ${error}`);
    }
  }

  /**
   * Run inference on an embedded model
   * 
   * @param modelName - Model identifier
   * @param input - Input tensor or array
   * @returns Output tensor
   */
  async runInference(
    modelName: string,
    input: tf.Tensor | number[][] | number[]
  ): Promise<tf.Tensor> {
    const model = this.models.get(modelName);
    if (!model || !model.loadedModel) {
      throw new Error(`Model not loaded: ${modelName}`);
    }

    try {
      // Convert input to tensor if needed
      let inputTensor: tf.Tensor;
      if (input instanceof tf.Tensor) {
        inputTensor = input;
      } else {
        inputTensor = tf.tensor(input as any);
      }

      // Add batch dimension if needed
      if (inputTensor.shape.length === model.inputShape.length) {
        inputTensor = tf.expandDims(inputTensor, 0);
      }

      // Run inference
      const output = model.loadedModel!.predict(inputTensor) as tf.Tensor;

      // Clean up
      inputTensor.dispose();

      return output;
    } catch (error) {
      console.error(`Inference error for ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Get loaded model info
   */
  getModel(modelName: string): EmbeddedModel | undefined {
    return this.models.get(modelName);
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(modelName: string): boolean {
    const model = this.models.get(modelName);
    return model?.isLoaded ?? false;
  }

  /**
   * Unload a model and free memory
   */
  unloadModel(modelName: string): void {
    const model = this.models.get(modelName);
    if (model?.loadedModel) {
      model.loadedModel.dispose();
      model.loadedModel = null;
      model.isLoaded = false;
      console.log(`♻️ Unloaded model: ${modelName}`);
    }
  }

  /**
   * Unload all models
   */
  unloadAll(): void {
    this.models.forEach((model) => {
      if (model.loadedModel) {
        model.loadedModel.dispose();
      }
    });
    this.models.clear();
    console.log('♻️ Unloaded all models');
  }

  /**
   * Get all loaded models info
   */
  getLoadedModels(): EmbeddedModel[] {
    return Array.from(this.models.values()).filter(m => m.isLoaded);
  }

  /**
   * Preprocess image data for model input
   */
  preprocessImage(
    imageData: number[],
    targetShape: number[]
  ): tf.Tensor {
    // Normalize to [0, 1]
    let tensor = tf.tensor(imageData);
    tensor = tf.cast(tensor, 'float32');
    tensor = tf.div(tensor, 255.0);

    // Reshape if needed
    if (tensor.shape.join(',') !== targetShape.join(',')) {
      tensor = tf.reshape(tensor, targetShape);
    }

    return tensor;
  }

  /**
   * Postprocess model output
   */
  postprocessOutput(
    output: tf.Tensor,
    threshold: number = 0.5
  ): any {
    const data = output.dataSync();
    
    if (data.length === 1) {
      // Single value output (classification)
      return {
        value: data[0],
        confidence: Math.max(data[0], 1 - data[0])
      };
    } else {
      // Multiple outputs (detection/classification)
      const values = Array.from(data);
      const maxIndex = values.indexOf(Math.max(...values));
      const confidence = values[maxIndex];

      return {
        predictions: values.map((v, i) => ({
          index: i,
          value: v,
          above_threshold: v > threshold
        })),
        topPrediction: {
          index: maxIndex,
          confidence: confidence
        }
      };
    }
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryStats(): Promise<any> {
    const memInfo = await tf.memory();
    return {
      numTensors: memInfo.numTensors,
      numDataBuffers: memInfo.numDataBuffers,
      numBytes: memInfo.numBytes,
      unreliable: memInfo.unreliable
    };
  }
}

// Export singleton
export const embeddedModelLoader = EmbeddedModelLoader.getInstance();
