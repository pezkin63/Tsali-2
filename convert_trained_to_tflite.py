"""
Convert trained models to TensorFlow Lite format
"""

import os
import tensorflow as tf
from pathlib import Path
import numpy as np
from PIL import Image

class TFLiteConverter:
    """Convert Keras models to quantized TFLite format"""
    
    def __init__(self, model_dir, output_dir):
        self.model_dir = Path(model_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def convert_model(self, model_name, quantize=True):
        """Convert a single model to TFLite"""
        print(f"\nConverting {model_name}...")
        
        model_path = self.model_dir / f'{model_name}.h5'
        if not model_path.exists():
            print(f"❌ Model not found: {model_path}")
            return False
        
        # Load model
        model = tf.keras.models.load_model(model_path)
        
        # Simple conversion using from_keras_model
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        
        if quantize:
            print("  Applying optimization...")
            # Use DEFAULT optimization (doesn't require representative dataset)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
        
        tflite_model = converter.convert()
        
        # Save TFLite model
        output_path = self.output_dir / f'{model_name}.tflite'
        with open(output_path, 'wb') as f:
            f.write(tflite_model)
        
        model_size_mb = len(tflite_model) / (1024 * 1024)
        print(f"✓ Saved {output_path}")
        print(f"  Size: {model_size_mb:.2f} MB")
        
        return True
    
    def convert_all(self, model_names=['staff_detector', 'symbol_recognizer'], quantize=True):
        """Convert all models"""
        print("="*60)
        print("CONVERTING MODELS TO TFLITE")
        print("="*60)
        
        for model_name in model_names:
            self.convert_model(model_name, quantize=quantize)
        
        print("\n" + "="*60)
        print("CONVERSION COMPLETE")
        print("="*60)
        print(f"TFLite models saved to: {self.output_dir}/")
        print("Copy .tflite files to: sheet-music-scanner/src/assets/models/")

def main():
    # Configuration
    model_dir = './trained_models'
    output_dir = './tflite_models'
    
    converter = TFLiteConverter(model_dir, output_dir)
    converter.convert_all(quantize=True)

if __name__ == '__main__':
    main()
