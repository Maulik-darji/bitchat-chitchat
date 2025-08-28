const fs = require('fs');
const path = require('path');

// Files to copy from public to build
const filesToCopy = [
  'sitemap.xml',
  'robots.txt',
  'google75c41f31bfd1c749.html'
];

console.log('Copying SEO files to build directory...');

filesToCopy.forEach(file => {
  const sourcePath = path.join(__dirname, 'public', file);
  const destPath = path.join(__dirname, 'build', file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${file}`);
  } else {
    console.log(`❌ Source file not found: ${file}`);
  }
});

console.log('SEO files copy complete!');
