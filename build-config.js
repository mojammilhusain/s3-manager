const fs = require('fs');
const path = require('path');

// Read environment variables (Netlify / GitHub Secrets / Local environment)
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "YOUR_AWS_ACCESS_KEY_ID";
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "YOUR_AWS_SECRET_ACCESS_KEY";
const region = process.env.AWS_REGION || "eu-north-1";
const defaultBucket = process.env.AWS_DEFAULT_BUCKET || "mojo-youtube";

const configContent = `// ============================================================
//  S3 Mobile Manager — Auto-generated configuration
//  Generated at build time from environment variables / secrets
// ============================================================
window.S3_CONFIG = {
  accessKeyId: "${accessKeyId}",
  secretAccessKey: "${secretAccessKey}",
  region: "${region}",

  // Optional: pin a default bucket so it opens instantly.
  // Leave "" to type/choose the bucket in the app the first time.
  defaultBucket: "${defaultBucket}"
};
`;

const configPath = path.join(__dirname, 'config.js');
fs.writeFileSync(configPath, configContent, 'utf8');
console.log('✅ Generated config.js successfully from environment variables.');
