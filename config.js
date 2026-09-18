// ============================================================
//  S3 Mobile Manager — configuration
//  Everything runs on-device in your browser. No server.
//  NOTE: These credentials are embedded in the app as you asked.
//  Recommended: use an IAM user scoped to ONLY your bucket.
//  (see README.md -> "Least-privilege IAM policy")
// ============================================================
window.S3_CONFIG = {
  accessKeyId: "YOUR_AWS_ACCESS_KEY_ID",
  secretAccessKey: "YOUR_AWS_SECRET_ACCESS_KEY",
  region: "eu-north-1",

  // Optional: pin a default bucket so it opens instantly.
  // Leave "" to type/choose the bucket in the app the first time.
  defaultBucket: "mojo-youtube"
};
