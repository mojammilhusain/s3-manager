# 🪣 S3 Mobile Manager — iPhone app

A lightweight, installable **iPhone app** (PWA) that talks straight to your S3
bucket **`mojo-youtube`** (`eu-north-1`). Use it to push photos/files from your
iPhone into the bucket — they then sync down to your laptop automatically. No
AWS Console login, no App Store, no Mac/Xcode needed.

Everything runs **on your phone**. The credentials are baked into
[`config.js`](./config.js) so you never log in again.

---

## Why a PWA (and not a "real" Xcode app)?

A native Swift/iOS app must be built on a **Mac with Xcode** and signed with an
Apple Developer account before it can run on an iPhone — you're on Windows, so
that path isn't available to you. A **PWA** ("Add to Home Screen") gives you the
same result you asked for: a tappable app icon on your home screen, full-screen,
its own window, works offline for the shell, and talks directly to S3. It's the
correct, lightweight choice for your setup.

---

## What it does

- 📂 Browse your bucket, folder by folder
- ⬇️ **One-tap download** with a Downloads panel (pause / resume / save)
- ⤴️ Upload any files, with a live progress bar
- 📷 Upload straight from Photos / Camera
- 🖼️ Preview images & videos in-app; open other files
- 🗑️ Delete files and folders
- ➕ Create folders
- 🪣 Switch between buckets

---

## ⚠️ Read this first (security)

These AWS keys are embedded in a file that lives on your phone/host. Anyone who
can open the app URL can use them. Since you shared them in chat, treat them as
**exposed** and do the following in the AWS Console:

1. **Create a dedicated IAM user** (e.g. `s3-phone`) with **only** the policy in
   [`iam-policy.json`](./iam-policy.json) — it can read/write/delete objects in
   `mojo-youtube` **and nothing else**. Put *that* user's keys in
   [`config.js`](./config.js) instead of your current ones.
2. **Rotate/disable** the keys you pasted in chat once the new ones work.
3. Keep the hosting **private/unlisted** (see options below).

This keeps the blast radius to just this one bucket.

---

## Step 1 — Apply the CORS rule to the bucket (one time)

The browser needs CORS enabled on `mojo-youtube`. The rule is in
[`s3-cors.json`](./s3-cors.json).

**Console:** S3 → `mojo-youtube` → **Permissions** → **Cross-origin resource
sharing (CORS)** → **Edit** → paste the contents of `s3-cors.json` → **Save**.

**Or via AWS CLI:**
```bash
aws s3api put-bucket-cors --bucket mojo-youtube --cors-configuration file://s3-cors.json
```

---

## Step 2 — Put the files online (pick ONE)

The app is just static files, but iPhone PWAs require **HTTPS**. Easiest options:

### Option A — Netlify Drop (recommended, ~1 min, free)
1. On your laptop, go to **https://app.netlify.com/drop**
2. Drag the whole **`S3-Mobile-Manager`** folder onto the page.
3. You get an HTTPS URL like `https://random-name.netlify.app`. Done.
   - (Optional) In Netlify → **Site settings** you can rename it or add
     password protection to keep it private.

### Option B — GitHub Pages
1. Create a **private** repo, push this folder.
2. Settings → Pages → deploy from `main` / root.
3. Use the `https://<user>.github.io/<repo>/` URL.
   > Note: GitHub Pages sites are public — prefer Option A if you want privacy.

### Option C — Test locally first (laptop only)
```powershell
cd "C:\Users\mojammil.husain\Desktop\S3-Mobile-Manager"
python -m http.server 8000
```
Open `http://localhost:8000` in your laptop browser to try it before deploying.

---

## Step 3 — Install it on your iPhone

1. Open the HTTPS URL from Step 2 in **Safari** (must be Safari, not Chrome).
2. Tap the **Share** button (□↑).
3. Tap **Add to Home Screen** → **Add**.
4. Launch **S3 Manager** from your home screen — it opens full-screen like a
   native app, already pointed at `mojo-youtube`.

That's it. No more AWS login.

---

## Using the app

| Action | How |
|---|---|
| Open a folder | Tap it |
| Go up | `‹` (top-left) |
| **Download a file** | Tap **⬇** on the row — one tap starts it |
| See downloads | **⬇ Loads** tab (bottom menu) |
| Pause / Resume a download | In the Downloads panel |
| Save a finished file to your phone | Tap **⬇ Save** → choose **Files** or **Photos** |
| Upload files | **⤴ Upload** tab |
| Upload photo/video | **📷 Photo** tab |
| New folder | **＋ Folder** tab |
| Preview / open a file | Tap `↗` on the row |
| Delete | Tap 🗑 |
| Switch bucket | **🪣 Bucket** tab |

### Downloading (the main feature)
- Tap **⬇** on any file — the download starts immediately and appears in the
  **⬇ Loads** panel with a live progress bar. A badge shows how many are active.
- Tap **⏸ Pause** any time; tap **▶ Resume** to continue from exactly where it
  stopped (it uses HTTP range requests, so no bytes are re-downloaded).
- When it's finished, tap **⬇ Save** — on iPhone this opens the share sheet so
  you can save straight into **Files** or **Photos**. **↗ Open** previews it.
- **Clear finished** empties completed items from the list.

Uploaded files land in whatever folder you're currently viewing, then your
laptop's existing S3 sync pulls them down.

---

## Files in this project

| File | Purpose |
|---|---|
| `index.html` / `styles.css` | UI shell |
| `app.js` | App logic (browse/upload/delete/preview) |
| `aws-s3.js` | Zero-dependency S3 client + AWS SigV4 signing (Web Crypto) |
| `config.js` | Your credentials, region, default bucket |
| `manifest.webmanifest` / `service-worker.js` | Makes it an installable, offline-capable app |
| `icons/` | App icons |
| `s3-cors.json` | Bucket CORS rule (apply once) |
| `iam-policy.json` | Least-privilege policy for a scoped IAM user |
| `make_icons.py` | Regenerates the icons (dev only) |

---

## Notes / limits

- Region is fixed to **`eu-north-1`**; change `region` in `config.js` if needed.
- Folder delete removes every object under it (recursively) — there's a confirm
  prompt, but there's no undo (unless the bucket has versioning).
- Signing uses presigned URLs (`UNSIGNED-PAYLOAD`) so uploads of large videos
  don't get hashed in the browser — fast even for big files.
