// ============================================================
//  aws-s3.js — tiny, dependency-free S3 client for the browser
//  Signs requests with AWS Signature V4 (query-string / presigned)
//  using the built-in Web Crypto API. Talks straight to S3 REST.
// ============================================================
const S3 = (() => {
  const cfg = window.S3_CONFIG;
  const enc = new TextEncoder();

  // ---- crypto helpers -------------------------------------------------
  function hex(buf) {
    const b = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  async function sha256hex(input) {
    const data = typeof input === "string" ? enc.encode(input) : input;
    return hex(await crypto.subtle.digest("SHA-256", data));
  }
  async function hmac(key, msg) {
    const raw = key instanceof Uint8Array ? key : enc.encode(key);
    const k = await crypto.subtle.importKey(
      "raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
  }
  // RFC-3986 style encoding that AWS expects.
  function awsEncode(str, encodeSlash = true) {
    let out = "";
    for (const ch of String(str)) {
      if (/[A-Za-z0-9\-_.~]/.test(ch)) {
        out += ch;
      } else if (ch === "/" && !encodeSlash) {
        out += "/";
      } else {
        for (const b of enc.encode(ch)) out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
      }
    }
    return out;
  }
  async function signingKey(dateStamp) {
    let k = await hmac("AWS4" + cfg.secretAccessKey, dateStamp);
    k = await hmac(k, cfg.region);
    k = await hmac(k, "s3");
    k = await hmac(k, "aws4_request");
    return k;
  }

  // ---- core: build a presigned URL ------------------------------------
  async function presign(method, { bucket, key = "", query = {}, expires = 3600 }) {
    const host = bucket
      ? `${bucket}.s3.${cfg.region}.amazonaws.com`
      : `s3.${cfg.region}.amazonaws.com`;

    const now = new Date();
    const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
    const datestamp = amzdate.slice(0, 8);
    const scope = `${datestamp}/${cfg.region}/s3/aws4_request`;

    const q = Object.assign({}, query, {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
      "X-Amz-Date": amzdate,
      "X-Amz-Expires": String(expires),
      "X-Amz-SignedHeaders": "host",
    });

    const canonicalQuery = Object.keys(q).sort()
      .map((k) => awsEncode(k) + "=" + awsEncode(q[k]))
      .join("&");

    const canonicalUri = "/" + key.split("/").map((s) => awsEncode(s)).join("/");
    const canonicalHeaders = `host:${host}\n`;
    const canonicalRequest = [
      method, canonicalUri, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256", amzdate, scope, await sha256hex(canonicalRequest),
    ].join("\n");

    const sig = hex(await hmac(await signingKey(datestamp), stringToSign));
    return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${sig}`;
  }

  // ---- helpers around fetch -------------------------------------------
  async function s3fetch(method, opts) {
    const url = await presign(method, opts);
    const res = await fetch(url, { method });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const msg = (text.match(/<Message>(.*?)<\/Message>/) || [])[1] || res.statusText;
      throw new Error(`S3 ${method} failed (${res.status}): ${msg}`);
    }
    return res;
  }
  const xmlText = (node, tag) => {
    const el = node.getElementsByTagName(tag)[0];
    return el ? el.textContent : "";
  };

  // ---- public operations ----------------------------------------------

  // List all buckets on the account (may be blocked by CORS on some setups).
  async function listBuckets() {
    const res = await s3fetch("GET", { bucket: "", key: "" });
    const doc = new DOMParser().parseFromString(await res.text(), "application/xml");
    return Array.from(doc.getElementsByTagName("Bucket")).map((b) => xmlText(b, "Name"));
  }

  // List objects/folders under a prefix (one "folder" level at a time).
  async function listObjects(bucket, prefix = "") {
    const folders = [];
    const files = [];
    let token = null;
    do {
      const query = { "list-type": "2", "delimiter": "/", "max-keys": "1000", prefix };
      if (token) query["continuation-token"] = token;
      const res = await s3fetch("GET", { bucket, key: "", query });
      const doc = new DOMParser().parseFromString(await res.text(), "application/xml");

      for (const cp of doc.getElementsByTagName("CommonPrefixes")) {
        folders.push(xmlText(cp, "Prefix"));
      }
      for (const c of doc.getElementsByTagName("Contents")) {
        const key = xmlText(c, "Key");
        if (key === prefix) continue; // the folder placeholder object itself
        files.push({
          key,
          size: parseInt(xmlText(c, "Size") || "0", 10),
          modified: xmlText(c, "LastModified"),
        });
      }
      token = xmlText(doc, "NextContinuationToken") || null;
    } while (token);

    return { folders, files };
  }

  // Presigned link for viewing / downloading an object.
  function downloadUrl(bucket, key, expires = 3600) {
    return presign("GET", { bucket, key, expires });
  }

  // Upload a File/Blob with progress (uses XHR for upload events).
  async function putObject(bucket, key, file, onProgress) {
    const url = await presign("PUT", { bucket, key, expires: 3600 });
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      if (file.type) xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () =>
        (xhr.status >= 200 && xhr.status < 300)
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  }

  async function deleteObject(bucket, key) {
    await s3fetch("DELETE", { bucket, key });
  }

  // Create an empty "folder" (zero-byte key ending in /).
  async function createFolder(bucket, prefix, name) {
    const key = `${prefix}${name.replace(/\/+$/,"")}/`;
    await putObject(bucket, key, new Blob([""], { type: "application/x-directory" }));
  }

  return {
    listBuckets, listObjects, downloadUrl, putObject, deleteObject, createFolder,
  };
})();
