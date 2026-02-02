#!/bin/bash
# Quick Start Script for Tsali Sheet Music Scanner

echo "🎵 Tsali Sheet Music Scanner - Quick Start"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "sheet-music-scanner/package.json" ]; then
    echo "❌ Error: Must run from project root where sheet-music-scanner/ exists"
    exit 1
fi

cd sheet-music-scanner

echo "📦 Installing dependencies..."
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native expo-camera expo-file-system expo-image-manipulator --save

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Add to your navigation:"
echo "   import { CameraScreenEnhanced } from '@screens/CameraScreenEnhanced';"
echo "   import { ViewerScreenEnhanced } from '@screens/ViewerScreenEnhanced';"
echo "   <Stack.Screen name='Camera' component={CameraScreenEnhanced} />"
echo "   <Stack.Screen name='Viewer' component={ViewerScreenEnhanced} />"
echo ""
echo "2. Run on device:"
echo "   npm run ios      # for iPhone"
echo "   npm run android  # for Android"
echo ""
echo "3. Grant camera permission when prompted"
echo ""
echo "4. Start scanning!"
echo ""
echo "📚 Documentation:"
echo "   • EMBEDDED_MODELS_SETUP.md"
echo "   • COMPLETE_SHEET_SCANNER_INTEGRATION.md"
echo "   • IMPLEMENTATION_CHECKLIST.md"
echo ""
echo "🎉 You're all set! Happy scanning!"
