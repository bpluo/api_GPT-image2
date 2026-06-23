# GPT Image Workshop

GPT Image Workshop is an interactive web application for researchers and creators.
It provides image generation and mask-based editing powered by OpenAI's GPT
image family (supports `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1` and
`gpt-image-1-mini`). The project is built with Next.js, TypeScript and a
component-driven UI.

## Key features

- Image generation and mask-guided edits
- Streaming preview (SSE) for step-by-step generation feedback
- Multiple models supported (`gpt-image-2` default)
- Local history with request parameters and estimated USD cost
- Two storage modes: server filesystem or browser IndexedDB (Dexie.js)
- Academic prompt presets and built-in mask editor

## Repository layout

- `src/app` — Next.js app routes and server code
- `src/components` — React UI components
- `src/lib` — utility modules (db, presets, cost utils)
- `generated-images/` — default location for saved images (when using FS mode)

## API routes

- `POST /api/images` — create or edit images (supports SSE streaming)
- `GET /api/image/[filename]` — read an image file when using filesystem storage
- `POST /api/image-delete` — remove an image (optional password required)
- `GET /api/auth-status` — check whether the app requires a password

## Quick start (local)

Prerequisites:

- Node.js >= 20

Install and run locally:

```bash
git clone https://github.com/bpluo/api_GPT-image2.git
cd api_GPT-image2
npm install
cp .env.example .env.local # or create .env.local manually
```

Create `.env.local` and set at least:

```env
OPENAI_API_KEY=your_openai_api_key
# Optional
# OPENAI_API_BASE_URL=
# NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs|indexeddb
# APP_PASSWORD=
```

Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Storage modes

- `fs` (default): generated images are written to `generated-images/`.
- `indexeddb`: for serverless platforms — server returns `b64_json` and the
  client stores decoded blobs in IndexedDB via Dexie.

## Environment variables

- `OPENAI_API_KEY` — required
- `OPENAI_API_BASE_URL` — optional, for custom endpoints
- `NEXT_PUBLIC_IMAGE_STORAGE_MODE` — `fs` or `indexeddb`
- `APP_PASSWORD` — optional admin password (server verifies hashed value)

## Deployment notes

- For serverless deployments (Vercel, Netlify functions), prefer
  `NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb` to avoid depending on writable
  server filesystem.
- Ensure `OPENAI_API_KEY` is provided in your deployment environment.

## Contributing

Contributions are welcome. Typical workflow:

1. Fork the repository
2. Create a feature branch
3. Open a pull request with descriptive changes

Note: This repository's history may have been rewritten. If you use this
project as a contributor, ensure you re-clone or properly reset your local
branches after history changes.

## License

See the repository `LICENSE` file for license terms.

---

Short description (also present in README.md):

> GPT Image Workshop — interactive web tool for researchers and creators,
> built on OpenAI's GPT image family. Features include image generation,
> mask-based edits, streaming previews (SSE), and local history with cost
> estimates.
