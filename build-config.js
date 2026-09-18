const fs = require('fs');
const path = require('path');

// Read AWS Credentials from environment secrets with flexible casing support
const accessKeyId = 
  process.env.MojoS3_ACCESS_KEY_ID ||
  process.env.MOJOS3_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID ||
  "YOUR_AWS_ACCESS_KEY_ID";

const secretAccessKey = 
  process.env.MojoS3_SECRET_ACCESS_KEY ||
  process.env.MOJOS3_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  "YOUR_AWS_SECRET_ACCESS_KEY";

const configContent = `// ============================================================
//  S3 Mobile Manager — Configuration
//  AWS Credentials injected at build time from environment secrets.
// ============================================================
window.S3_CONFIG = {
  accessKeyId: "${accessKeyId}",
  secretAccessKey: "${secretAccessKey}",
  region: "eu-north-1",
  defaultBucket: "mojo-youtube"
};
`;

const configPath = path.join(__dirname, 'config.js');
fs.writeFileSync(configPath, configContent, 'utf8');
console.log('✅ Generated config.js successfully with credentials from environment secrets.');
