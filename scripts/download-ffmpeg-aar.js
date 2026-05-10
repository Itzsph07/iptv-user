// scripts/download-ffmpeg-aar.js
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 🔧 REPLACE with YOUR actual AAR URL
const AAR_URL = process.env.FFMPEG_AAR_URL 
  || 'https://raw.githubusercontent.com/Itzsph07/iptv-user/master/scripts/ffmpeg-kit-full-gpl.aar';

const AAR_DIR = path.join(__dirname, '..', 'android', 'app', 'libs');
const AAR_PATH = path.join(AAR_DIR, 'ffmpeg-kit-full-gpl.aar');

// Skip if file already exists and is valid (> 1MB)
if (fs.existsSync(AAR_PATH) && fs.statSync(AAR_PATH).size > 1000000) {
  console.log('✅ FFmpeg AAR already exists (' + 
    (fs.statSync(AAR_PATH).size / 1024 / 1024).toFixed(1) + 'MB)');
  process.exit(0);
}

// Create libs directory
if (!fs.existsSync(AAR_DIR)) {
  fs.mkdirSync(AAR_DIR, { recursive: true });
}

console.log('📥 Downloading FFmpeg AAR...');
console.log('   URL:', AAR_URL.substring(0, 80) + '...');

// Delete corrupted/empty file
if (fs.existsSync(AAR_PATH)) {
  fs.unlinkSync(AAR_PATH);
}

const protocol = AAR_URL.startsWith('https') ? https : http;

function download(url) {
  protocol.get(url, (response) => {
    // Follow redirects (GitHub does 302)
    if (response.statusCode === 302 || response.statusCode === 301) {
      download(response.headers.location);
      return;
    }

    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloaded = 0;
    const file = fs.createWriteStream(AAR_PATH);

    response.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalSize) {
        const pct = ((downloaded / totalSize) * 100).toFixed(0);
        const mb = (downloaded / 1024 / 1024).toFixed(1);
        process.stdout.write('   ' + pct + '% (' + mb + 'MB)\r');
      }
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close();
      const size = fs.statSync(AAR_PATH).size;
      console.log('');
      console.log('✅ Downloaded:', (size / 1024 / 1024).toFixed(1) + 'MB');
      
      // Verify it's not empty
      if (size < 1000000) {
        console.error('❌ File too small (' + size + ' bytes)! Check URL.');
        fs.unlinkSync(AAR_PATH);
        process.exit(1);
      }
    });

    file.on('error', (err) => {
      if (fs.existsSync(AAR_PATH)) fs.unlinkSync(AAR_PATH);
      console.error('❌ Write error:', err.message);
      process.exit(1);
    });
  }).on('error', (err) => {
    if (fs.existsSync(AAR_PATH)) fs.unlinkSync(AAR_PATH);
    console.error('❌ Download error:', err.message);
    process.exit(1);
  });
}

download(AAR_URL);