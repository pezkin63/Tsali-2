"""
Fast OMR Model Training Pipeline (Lightweight)
Trains smaller, faster models suitable for mobile
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from PIL import Image
from pathlib import Path
import json
from sklearn.model_selection import train_test_split

# Avoid OpenCV - use PIL for image processing
def cv2_resize(image, size):
    """Resize image to target size using PIL"""
    if isinstance(image, np.ndarray):
        img = Image.fromarray(image)
    else:
        img = image
    return np.array(img.resize(size, Image.Resampling.LANCZOS))

# Configuration - OPTIMIZED FOR SPEED
CONFIG = {
    'data_dir': './potentialmodels',
    'output_dir': './trained_models',
    'staff_detector_input_size': (128, 128),  # Smaller input
    'symbol_recognizer_input_size': (32, 32),
    'batch_size': 4,
    'epochs': 20,  # Fewer epochs
    'augmentation': True,
    'quantize': True,
}

class FastDataLoader:
    """Load and prepare training data"""
    
    def __init__(self, data_dir, staff_size=(128, 128), symbol_size=(32, 32)):
        self.data_dir = Path(data_dir)
        self.staff_size = staff_size
        self.symbol_size = symbol_size
        self.symbol_classes = {}
        
    def load_staff_detection_data(self):
        """Load background/overlay pairs for staff detection"""
        backgrounds = sorted([f for f in os.listdir(self.data_dir) if f.startswith('background_') and f.endswith('.jpeg')])
        overlays = sorted([f for f in os.listdir(self.data_dir) if f.startswith('overlay_') and f.endswith('.png')])
        
        images = []
        masks = []
        
        print(f"Loading {len(backgrounds)} staff detection training images...")
        
        for i, (bg_file, overlay_file) in enumerate(zip(backgrounds, overlays)):
            print(f"  [{i+1}/{len(backgrounds)}] {bg_file}", end='\r')
            
            # Load background
            bg_path = self.data_dir / bg_file
            img = np.array(Image.open(bg_path).convert('RGB'))
            img = cv2_resize(img, self.staff_size)
            img = img.astype(np.float32) / 255.0
            images.append(img)
            
            # Load mask
            mask_path = self.data_dir / overlay_file
            mask = np.array(Image.open(mask_path).convert('L'))
            mask = cv2_resize(mask, self.staff_size)
            mask = (mask > 127).astype(np.float32)
            masks.append(np.expand_dims(mask, axis=-1))
        
        print(f"\n✓ Loaded {len(images)} images")
        return np.array(images), np.array(masks)
    
    def load_symbol_recognition_data(self):
        """Load individual symbols for classification"""
        symbol_files = {}
        
        # Map symbol files to classes
        for f in os.listdir(self.data_dir):
            if f.endswith('.png') and not f.startswith('overlay'):
                parts = f.split('_')
                if len(parts) >= 2 and parts[0].isdigit():
                    class_id = parts[0]
                    if class_id not in symbol_files:
                        symbol_files[class_id] = []
                    symbol_files[class_id].append(f)
        
        self.symbol_classes = {v: k for k, v in enumerate(symbol_files.keys())}
        num_classes = len(self.symbol_classes)
        
        images = []
        labels = []
        
        print(f"Loading symbol recognition data ({num_classes} classes)...")
        print(f"Classes: {list(symbol_files.keys())}")
        
        for class_id, files in symbol_files.items():
            class_idx = self.symbol_classes[class_id]
            for f in files:
                img_path = self.data_dir / f
                img = np.array(Image.open(img_path).convert('RGB'))
                img = cv2_resize(img, self.symbol_size)
                img = img.astype(np.float32) / 255.0
                images.append(img)
                labels.append(class_idx)
                print(f"  Loaded {f} -> class {class_id}")
        
        print(f"✓ Loaded {len(images)} symbols")
        return np.array(images), np.array(labels), num_classes
    
    def augment_staff_data(self, images, masks):
        """Minimal data augmentation"""
        augmented_images = [images]
        augmented_masks = [masks]
        
        # Brightness variation
        aug_imgs = []
        aug_masks = []
        for img, mask in zip(images, masks):
            bright_img = np.clip(img * np.random.uniform(0.85, 1.15), 0, 1)
            aug_imgs.append(bright_img)
            aug_masks.append(mask)
        augmented_images.append(np.array(aug_imgs))
        augmented_masks.append(np.array(aug_masks))
        
        return np.vstack(augmented_images), np.vstack(augmented_masks)

class FastStaffDetectorModel:
    """Minimal U-Net for staff detection"""
    
    @staticmethod
    def build(input_shape):
        """Build compact segmentation model"""
        inputs = keras.Input(shape=input_shape)
        
        # Compact encoder
        c1 = layers.Conv2D(16, 3, activation='relu', padding='same')(inputs)
        p1 = layers.MaxPooling2D((2, 2))(c1)
        
        c2 = layers.Conv2D(32, 3, activation='relu', padding='same')(p1)
        p2 = layers.MaxPooling2D((2, 2))(c2)
        
        c3 = layers.Conv2D(64, 3, activation='relu', padding='same')(p2)
        
        # Decoder
        u4 = layers.UpSampling2D((2, 2))(c3)
        u4 = layers.concatenate([u4, c2])
        c4 = layers.Conv2D(32, 3, activation='relu', padding='same')(u4)
        
        u5 = layers.UpSampling2D((2, 2))(c4)
        u5 = layers.concatenate([u5, c1])
        c5 = layers.Conv2D(16, 3, activation='relu', padding='same')(u5)
        
        # Output
        outputs = layers.Conv2D(1, 1, activation='sigmoid')(c5)
        
        model = keras.Model(inputs=inputs, outputs=outputs)
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy']
        )
        return model

class FastSymbolRecognizerModel:
    """Compact CNN for symbol classification"""
    
    @staticmethod
    def build(input_shape, num_classes):
        """Build compact classification model"""
        model = keras.Sequential([
            keras.Input(shape=input_shape),
            
            layers.Conv2D(16, 3, activation='relu', padding='same'),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(0.2),
            
            layers.Conv2D(32, 3, activation='relu', padding='same'),
            layers.MaxPooling2D((2, 2)),
            layers.Dropout(0.2),
            
            layers.Flatten(),
            layers.Dense(128, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(num_classes, activation='softmax')
        ])
        
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        return model

def train_models():
    """Main training function"""
    os.makedirs(CONFIG['output_dir'], exist_ok=True)
    
    # Load data
    loader = FastDataLoader(
        CONFIG['data_dir'],
        staff_size=CONFIG['staff_detector_input_size'],
        symbol_size=CONFIG['symbol_recognizer_input_size']
    )
    
    print("\n" + "="*60)
    print("LOADING TRAINING DATA")
    print("="*60)
    
    # Staff detection data
    staff_images, staff_masks = loader.load_staff_detection_data()
    
    if CONFIG['augmentation']:
        print("Applying data augmentation...")
        staff_images, staff_masks = loader.augment_staff_data(staff_images, staff_masks)
    
    X_staff_train, X_staff_val, y_staff_train, y_staff_val = train_test_split(
        staff_images, staff_masks, test_size=0.2, random_state=42
    )
    
    # Symbol recognition data
    symbol_images, symbol_labels, num_classes = loader.load_symbol_recognition_data()
    
    if len(symbol_images) > 2:
        X_symbol_train, X_symbol_val, y_symbol_train, y_symbol_val = train_test_split(
            symbol_images, symbol_labels, test_size=0.3, random_state=42
        )
    else:
        # Too few samples, use all for training
        X_symbol_train, y_symbol_train = symbol_images, symbol_labels
        X_symbol_val, y_symbol_val = symbol_images[:1], symbol_labels[:1]
    
    print("\n" + "="*60)
    print("TRAINING STAFF DETECTION MODEL")
    print("="*60)
    
    # Train staff detector
    staff_model = FastStaffDetectorModel.build(
        input_shape=(*CONFIG['staff_detector_input_size'], 3)
    )
    
    print(f"Training samples: {len(X_staff_train)}, Validation samples: {len(X_staff_val)}")
    staff_history = staff_model.fit(
        X_staff_train, y_staff_train,
        validation_data=(X_staff_val, y_staff_val),
        epochs=CONFIG['epochs'],
        batch_size=CONFIG['batch_size'],
        verbose=1
    )
    
    staff_model.save(os.path.join(CONFIG['output_dir'], 'staff_detector.h5'))
    print("✓ Saved staff_detector.h5")
    
    print("\n" + "="*60)
    print("TRAINING SYMBOL RECOGNITION MODEL")
    print("="*60)
    
    # Train symbol recognizer
    symbol_model = FastSymbolRecognizerModel.build(
        input_shape=(*CONFIG['symbol_recognizer_input_size'], 3),
        num_classes=num_classes
    )
    
    print(f"Training samples: {len(X_symbol_train)}, Validation samples: {len(X_symbol_val)}")
    symbol_history = symbol_model.fit(
        X_symbol_train, y_symbol_train,
        validation_data=(X_symbol_val, y_symbol_val),
        epochs=CONFIG['epochs'],
        batch_size=CONFIG['batch_size'],
        verbose=1
    )
    
    symbol_model.save(os.path.join(CONFIG['output_dir'], 'symbol_recognizer.h5'))
    print("✓ Saved symbol_recognizer.h5")
    
    # Save training metadata
    metadata = {
        'staff_detector': {
            'input_size': CONFIG['staff_detector_input_size'],
            'training_samples': len(X_staff_train),
            'validation_samples': len(X_staff_val),
        },
        'symbol_recognizer': {
            'input_size': CONFIG['symbol_recognizer_input_size'],
            'num_classes': num_classes,
            'classes': loader.symbol_classes,
            'training_samples': len(X_symbol_train),
            'validation_samples': len(X_symbol_val),
        }
    }
    
    with open(os.path.join(CONFIG['output_dir'], 'training_metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print("\n" + "="*60)
    print("✓ TRAINING COMPLETE!")
    print("="*60)
    print(f"Models saved to: {CONFIG['output_dir']}/")
    print("\nNext steps:")
    print("1. Convert to TFLite: python3 convert_trained_to_tflite.py")
    print("2. Copy models to: sheet-music-scanner/src/assets/models/")

if __name__ == '__main__':
    train_models()
