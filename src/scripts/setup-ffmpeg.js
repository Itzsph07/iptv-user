// src/scripts/setup-ffmpeg.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const AAR_URL = 'https://github.com/NooruddinLakhani/ffmpeg-kit-full-gpl/releases/download/v1.0.0/ffmpeg-kit-full-gpl.aar';

function downloadAAR() {
  const libsDir = path.join(__dirname, '..', '..', 'android', 'app', 'libs');
  const aarPath = path.join(libsDir, 'ffmpeg-kit-full-gpl.aar');
  
  if (!fs.existsSync(libsDir)) {
    fs.mkdirSync(libsDir, { recursive: true });
  }
  
  if (fs.existsSync(aarPath)) {
    console.log('✅ AAR already exists');
    return;
  }
  
  console.log('📥 Downloading FFmpeg AAR...');
  const file = fs.createWriteStream(aarPath);
  https.get(AAR_URL, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('✅ AAR downloaded');
    });
  }).on('error', (err) => {
    fs.unlink(aarPath);
    console.error('Error:', err.message);
  });
}

downloadAAR();