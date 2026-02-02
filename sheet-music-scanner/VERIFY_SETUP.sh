#!/bin/bash

echo "🔍 Tsali Sheet Scanner - Setup Verification"
echo "==========================================="
echo ""

cd /workspaces/Tsali-2/sheet-music-scanner 2>/dev/null || { echo "❌ Project folder not found"; exit 1; }

# Check services
echo "✓ Checking Services..."
[ -f "src/services/EmbeddedModelLoader.ts" ] && echo "  ✅ EmbeddedModelLoader.ts" || echo "  ❌ EmbeddedModelLoader.ts"
[ -f "src/services/EnhancedMusicRecognition.ts" ] && echo "  ✅ EnhancedMusicRecognition.ts" || echo "  ❌ EnhancedMusicRecognition.ts"

# Check screens
echo ""
echo "✓ Checking UI Components..."
[ -f "src/screens/CameraScreenEnhanced.tsx" ] && echo "  ✅ CameraScreenEnhanced.tsx" || echo "  ❌ CameraScreenEnhanced.tsx"
[ -f "src/screens/ViewerScreenEnhanced.tsx" ] && echo "  ✅ ViewerScreenEnhanced.tsx" || echo "  ❌ ViewerScreenEnhanced.tsx"

# Check models
echo ""
echo "✓ Checking Embedded Models..."
[ -f "keySignatures_c_model.json" ] && echo "  ✅ keySignatures_c_model.json" || echo "  ❌ keySignatures_c_model.json"
[ -f "keySignatures_digit_model.json" ] && echo "  ✅ keySignatures_digit_model.json" || echo "  ❌ keySignatures_digit_model.json"
[ -f "ocr_model.json" ] && echo "  ✅ ocr_model.json" || echo "  ❌ ocr_model.json"

# Check dependencies
echo ""
echo "✓ Checking Dependencies..."
npm ls @tensorflow/tfjs >/dev/null 2>&1 && echo "  ✅ TensorFlow.js installed" || echo "  ❌ TensorFlow.js missing"
npm ls expo-camera >/dev/null 2>&1 && echo "  ✅ expo-camera installed" || echo "  ❌ expo-camera missing"
npm ls expo-image-manipulator >/dev/null 2>&1 && echo "  ✅ expo-image-manipulator installed" || echo "  ❌ expo-image-manipulator missing"

# Check routes
echo ""
echo "✓ Checking Navigation Routes..."
grep -q "CameraScreenEnhanced" src/navigation/RootNavigator.tsx && echo "  ✅ CameraScreenEnhanced imported" || echo "  ❌ CameraScreenEnhanced not imported"
grep -q "ViewerScreenEnhanced" src/navigation/RootNavigator.tsx && echo "  ✅ ViewerScreenEnhanced imported" || echo "  ❌ ViewerScreenEnhanced not imported"
grep -q "ScannerEnhanced" src/navigation/RootNavigator.tsx && echo "  ✅ ScannerEnhanced route added" || echo "  ❌ ScannerEnhanced route missing"
grep -q "ViewerEnhanced" src/navigation/RootNavigator.tsx && echo "  ✅ ViewerEnhanced route added" || echo "  ❌ ViewerEnhanced route missing"

# Check permissions
echo ""
echo "✓ Checking Permissions..."
grep -q "NSCameraUsageDescription" app.json && echo "  ✅ iOS camera permission configured" || echo "  ❌ iOS camera permission missing"
grep -q "android.permission.CAMERA" app.json && echo "  ✅ Android camera permission configured" || echo "  ❌ Android camera permission missing"

echo ""
echo "📊 Summary:"
echo "==========="
SERVICES=$([ -f "src/services/EmbeddedModelLoader.ts" ] && [ -f "src/services/EnhancedMusicRecognition.ts" ] && echo "✅" || echo "❌")
SCREENS=$([ -f "src/screens/CameraScreenEnhanced.tsx" ] && [ -f "src/screens/ViewerScreenEnhanced.tsx" ] && echo "✅" || echo "❌")
MODELS=$([ -f "keySignatures_c_model.json" ] && [ -f "keySignatures_digit_model.json" ] && [ -f "ocr_model.json" ] && echo "✅" || echo "❌")

echo ""
echo "Services:  $SERVICES"
echo "Components: $SCREENS"
echo "Models:    $MODELS"

if [ "$SERVICES" = "✅" ] && [ "$SCREENS" = "✅" ] && [ "$MODELS" = "✅" ]; then
  echo ""
  echo "✨ All systems GO! Ready to deploy. ✨"
  echo ""
  echo "Start the app with:"
  echo "  npm run ios      # for iPhone"
  echo "  npm run android  # for Android"
else
  echo ""
  echo "⚠️  Some components are missing. Check above."
fi
