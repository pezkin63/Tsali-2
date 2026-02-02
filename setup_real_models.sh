#!/bin/bash

echo "🚀 Setting up Real OMR Models for React Native"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check Node/npm
echo -e "${BLUE}[1/4]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js found: $(node --version)"

# Step 2: Install TensorFlow.js
echo -e "${BLUE}[2/4]${NC} Installing TensorFlow.js packages..."
cd sheet-music-scanner
npm install --save @tensorflow/tfjs @tensorflow/tfjs-react-native 2>/dev/null
echo -e "${GREEN}✓${NC} TensorFlow.js installed"

# Step 3: Verify model files
echo -e "${BLUE}[3/4]${NC} Verifying converted models..."
if [ -f "src/assets/models/staff_detector_tfjs/model.json" ]; then
    echo -e "${GREEN}✓${NC} Staff Detector model found"
else
    echo "❌ Staff Detector model not found"
fi

if [ -f "src/assets/models/symbol_recognizer_tfjs/model.json" ]; then
    echo -e "${GREEN}✓${NC} Symbol Recognizer model found"
else
    echo "❌ Symbol Recognizer model not found"
fi

# Step 4: Summary
echo -e "${BLUE}[4/4]${NC} Setup complete!"
echo ""
echo -e "${GREEN}✅ Real Models Setup Complete!${NC}"
echo ""
echo "📚 Next steps:"
echo "1. Import the hook: import { useMusicRecognition } from './ml/useRealOMRModels'"
echo "2. Use in component: const models = useMusicRecognition()"
echo "3. Run inference: const result = await models.recognizeSymbol(imageData, 32, 32)"
echo ""
echo "📖 Read REAL_MODELS_SETUP.md for complete guide"
echo ""

