// ============================================================
//  S3 Mobile Manager — configuration template
//  Copy this file to config.js and fill in your AWS credentials.
// ============================================================
window.S3_CONFIG = {
  accessKeyId: "YOUR_AWS_ACCESS_KEY_ID",
  secretAccessKey: "YOUR_AWS_SECRET_ACCESS_KEY",
  region: "eu-north-1",

  // Optional: pin a default bucket so it opens instantly.
  // Leave "" to type/choose the bucket in the app the first time.
  defaultBucket: "my-bucket-name"
};
