# <img src="./public/favicon.svg" alt="Project Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT Image Workshop

A web-based image generation and editing workspace built on OpenAI GPT Image models (`gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`).

> **Note:** The workspace defaults to OpenAI's latest `gpt-image-2` model. In addition to legacy fixed sizes, it supports arbitrary resolutions up to 4K with constraint validation.

<p align="center">
  <img src="./readme-images/interface.jpg" alt="Main interface screenshot" width="600"/>
</p>

---

## ✨ Features

**🎨 Image generation mode**: create brand-new images from text prompts.

**🖌️ Image editing mode**: modify existing images locally with a text instruction and optional mask.

**⚙️ Full API parameter control**: adjust the key OpenAI Images API parameters directly in the UI — model, size, output format, compression quality, background, moderation, and number of images.

**📐 Custom resolutions (gpt-image-2)**: choose from 2K / 4K presets or enter a custom width × height, with live validation against model constraints:
- width and height must be multiples of **16**
- max side length: **3840 px**
- aspect ratio ≤ **3:1**
- total pixels: **655,360 ~ 8,294,400**

**🎭 Integrated mask tool**: paint a mask directly on the image in edit mode, or upload an external mask image.

> ⚠️ Note: `gpt-image-1` does not yet guarantee 100% precise mask control.<br>
> 1) [This is a known and acknowledged model limitation.](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/37)<br>
> 2) [OpenAI plans to improve this in a future update.](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/41)

<p align="center">
  <img src="./readme-images/mask-creation.jpg" alt="Mask editor" width="350"/>
</p>

**📜 Detailed history and cost tracking**:
- review the full history of generated and edited images
- inspect the parameters used for each request
- see API token usage and estimated cost in `$USD` — **tip: click the `$` amount on an image to view details**
- view the full prompt used for each history item
- review total historical API cost
- delete items from history

<p align="center">
  <img src="./readme-images/history.jpg" alt="History panel" width="1306"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="Cost breakdown" width="350"/>
</p>

**🖼️ Flexible output view**: browse batches in a grid or open a single image for a closer look.

**🚀 Send to edit**: quickly send any generated image or history item into the edit form.

**📋 Paste from clipboard**: paste images directly into the source image area in edit mode.

**💾 Two storage modes** via `NEXT_PUBLIC_IMAGE_STORAGE_MODE`:
- **Filesystem (default)**: images are saved to `./generated-images` on the server
- **IndexedDB**: images are stored directly in the browser's IndexedDB (**ideal for serverless deployments**)
- generation history metadata is always stored in the browser's local storage

---
## 🚀 Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
# Optional
# OPENAI_API_BASE_URL=your_compatible_api_endpoint_here
# NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
# APP_PASSWORD=your_password_here
```

### 3. Start the dev server

```bash
npm run dev
```

### 4. Open the app

Visit `http://localhost:3000`.

## ⚙️ Configuration

- `OPENAI_API_KEY`: required.
- `OPENAI_API_BASE_URL`: optional, for custom compatible endpoints.
- `NEXT_PUBLIC_IMAGE_STORAGE_MODE`: `fs` or `indexeddb`.
- `APP_PASSWORD`: optional, protects sensitive actions.

## 🚢 Deployment notes

- Node.js 20 or newer is required.
- For serverless deployments, use `indexeddb`.
- If you use `fs` mode, make sure `generated-images/` is writable.

## ❓ FAQ

- Which models are supported?
  - `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`
- Why do images sometimes fail to load?
  - In `fs` mode, check directory write permissions.
  - In `indexeddb` mode, check browser storage permissions.

## 🤝 Contact

If you need help or want to report an issue, open one in the repository.
