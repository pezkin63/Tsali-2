"""
OMR Service - Real Model Integration
Uses trained staff detector and symbol recognizer models
"""

import numpy as np
import cv2
from pathlib import Path
from typing import List, Dict, Any

class StaffDetector:
    """Detect staff lines in sheet music"""
    
    def __init__(self, model_path: str):
        """Initialize with TFLite model"""
        import tensorflow as tf
        self.interpreter = tf.lite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.input_size = tuple(self.input_details[0]['shape'][1:3])
    
    def detect(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Detect staffs in image
        
        Args:
            image: BGR image from camera/file
            
        Returns:
            Dict with staffs, confidence, and segmentation
        """
        # Preprocess
        h, w = image.shape[:2]
        input_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        input_image = cv2.resize(input_image, self.input_size)
        input_image = input_image.astype(np.float32) / 255.0
        
        # Run inference
        self.interpreter.set_tensor(
            self.input_details[0]['index'],
            np.expand_dims(input_image, 0)
        )
        self.interpreter.invoke()
        
        # Get output
        segmentation = self.interpreter.get_tensor(
            self.output_details[0]['index']
        )[0]  # Shape: (height, width, 1)
        
        # Post-process
        mask = (segmentation[:, :, 0] > 0.5).astype(np.uint8)
        mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
        
        # Find contours (staff regions)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        staffs = []
        for cnt in contours:
            x, y, w_box, h_box = cv2.boundingRect(cnt)
            if h_box > 20:  # Filter small contours
                staffs.append({
                    'bbox': (x, y, w_box, h_box),
                    'confidence': float(np.mean(segmentation[y:y+h_box, x:x+w_box])),
                    'contour': cnt
                })
        
        return {
            'staffs': sorted(staffs, key=lambda s: s['bbox'][1]),  # Sort by y
            'segmentation_mask': mask,
            'confidence': float(np.mean(segmentation))
        }


class SymbolRecognizer:
    """Recognize musical symbols"""
    
    def __init__(self, model_path: str, class_mapping: Dict[int, str]):
        """Initialize with TFLite model"""
        import tensorflow as tf
        self.interpreter = tf.lite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.input_size = tuple(self.input_details[0]['shape'][1:3])
        self.class_mapping = class_mapping
    
    def recognize(self, symbol_image: np.ndarray) -> Dict[str, Any]:
        """
        Recognize a symbol
        
        Args:
            symbol_image: Cropped symbol image
            
        Returns:
            Dict with class, confidence
        """
        # Preprocess
        img = cv2.cvtColor(symbol_image, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, self.input_size)
        img = img.astype(np.float32) / 255.0
        
        # Run inference
        self.interpreter.set_tensor(
            self.input_details[0]['index'],
            np.expand_dims(img, 0)
        )
        self.interpreter.invoke()
        
        # Get output
        predictions = self.interpreter.get_tensor(
            self.output_details[0]['index']
        )[0]
        
        class_idx = np.argmax(predictions)
        confidence = float(predictions[class_idx])
        
        return {
            'class': self.class_mapping.get(class_idx, f'class_{class_idx}'),
            'class_id': int(class_idx),
            'confidence': confidence,
            'all_predictions': {
                self.class_mapping.get(i, f'class_{i}'): float(p)
                for i, p in enumerate(predictions)
            }
        }


class OMRService:
    """Complete OMR pipeline using real models"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self.staff_detector = None
        self.symbol_recognizer = None
        self.is_initialized = False
    
    async def initialize(self, 
                        staff_model_path: str = None,
                        symbol_model_path: str = None,
                        class_mapping: Dict[int, str] = None):
        """
        Initialize the OMR service with model paths
        
        Args:
            staff_model_path: Path to staff detector TFLite model
            symbol_model_path: Path to symbol recognizer TFLite model
            class_mapping: Mapping of class indices to symbol names
        """
        try:
            if staff_model_path:
                self.staff_detector = StaffDetector(staff_model_path)
                print("✓ Staff detector initialized")
            
            if symbol_model_path:
                self.symbol_recognizer = SymbolRecognizer(
                    symbol_model_path,
                    class_mapping or {}
                )
                print("✓ Symbol recognizer initialized")
            
            self.is_initialized = True
            return {'success': True, 'message': 'OMR service initialized'}
        
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def scan_sheet_music(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Scan and recognize sheet music
        
        Args:
            image: Image array (BGR format from camera/file)
            
        Returns:
            Recognized music data in MusicXML format
        """
        if not self.is_initialized:
            return {'success': False, 'error': 'OMR service not initialized'}
        
        try:
            # Step 1: Detect staffs
            detection_result = self.staff_detector.detect(image)
            staffs = detection_result['staffs']
            
            if not staffs:
                return {
                    'success': True,
                    'measures': [],
                    'warning': 'No staffs detected in image'
                }
            
            # Step 2: Extract symbols from each staff region
            measures = []
            for staff_idx, staff in enumerate(staffs):
                x, y, w, h = staff['bbox']
                staff_region = image[y:y+h, x:x+w]
                
                # Simple symbol detection: find connected components
                symbols = self._extract_symbols(staff_region)
                
                # Recognize each symbol
                measure = {
                    'staff_id': staff_idx,
                    'symbols': []
                }
                
                for sym_idx, symbol_img in enumerate(symbols):
                    if symbol_img.size > 0:
                        result = self.symbol_recognizer.recognize(symbol_img)
                        measure['symbols'].append({
                            'index': sym_idx,
                            'type': result['class'],
                            'confidence': result['confidence'],
                            'position_x': sym_idx  # Relative position in staff
                        })
                
                measures.append(measure)
            
            return {
                'success': True,
                'measures': measures,
                'confidence': detection_result['confidence'],
                'num_staffs': len(staffs)
            }
        
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _extract_symbols(self, staff_image: np.ndarray) -> List[np.ndarray]:
        """Extract individual symbols from staff region"""
        # Convert to grayscale
        gray = cv2.cvtColor(staff_image, cv2.COLOR_BGR2GRAY)
        
        # Threshold
        _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
        
        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        symbols = []
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if w > 5 and h > 5:  # Filter noise
                symbol = staff_image[y:y+h, x:x+w]
                symbols.append(symbol)
        
        return sorted(symbols, key=lambda s: cv2.boundingRect(cv2.findNonZero(cv2.cvtColor(s, cv2.COLOR_BGR2GRAY)))[0] if cv2.findNonZero(cv2.cvtColor(s, cv2.COLOR_BGR2GRAY)) is not None else 0)

# Singleton instance
_omr_service = OMRService()

def get_omr_service():
    """Get OMR service instance"""
    return _omr_service
