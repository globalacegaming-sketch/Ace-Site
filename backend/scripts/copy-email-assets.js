const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/templates/email/logo-email.png');
const destDir = path.join(__dirname, '../dist/templates/email');
const dest = path.join(destDir, 'logo-email.png');

if (!fs.existsSync(src)) {
  console.warn('copy-email-assets: logo-email.png not found, skipping');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('copy-email-assets: copied logo-email.png to dist');
