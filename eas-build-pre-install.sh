#!/bin/bash
# eas-build-pre-install.sh - Runs BEFORE npm install on EAS

echo "🔧 Setting up FFmpeg for EAS build..."

# Create libs directory
mkdir -p android/app/libs

# Download AAR if not exists
if [ ! -f android/app/libs/ffmpeg-kit-full-gpl.aar ]; then
    echo "📥 Downloading FFmpegKit AAR..."
    curl -L -o android/app/libs/ffmpeg-kit-full-gpl.aar \
      https://github.com/NooruddinLakhani/ffmpeg-kit-full-gpl/releases/download/v1.0.0/ffmpeg-kit-full-gpl.aar
    echo "✅ AAR downloaded"
else
    echo "✅ AAR already exists"
fi

echo "✅ FFmpeg setup complete"