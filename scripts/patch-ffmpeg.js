const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', '@chadify', 'ffmpeg-kit-react-native', 'android', 'build.gradle');

if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the broken dependency
    content = content.replace(
        /implementation 'com\.arthenica:ffmpeg-kit-https:6\.0-2'/g,
        "implementation(name: 'ffmpeg-kit-full-gpl', ext: 'aar')"
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Patched @chadify/ffmpeg-kit-react-native');
} else {
    console.log('⚠️ File not found');
}