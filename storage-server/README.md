# Vibe Storage Server

Express-based media server with image processing (sharp), video thumbnails (ffmpeg), and optional S3 storage.

## Prerequisites

- Node.js 22+
- ffmpeg + ffprobe (for video thumbnails)
- AWS credentials (optional, for S3)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm start` | Start production |

## Ports

| Server | Env | Default |
|---|---|---|
| HTTP | `PORT` | 3002 |

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/upload` | Multipart file upload |
| POST | `/upload/raw` | Raw binary upload |
| GET | `/media/:filename` | Serve media (with resize/crop/format via query) |
| GET | `/uploads/:filename` | Same as `/media/:filename` |
| POST | `/classify` | Classify image by filename |
| GET | `/health` | Health check |

## Query params for media serving

| Param | Description |
|---|---|
| `w` | Resize width |
| `h` | Resize height |
| `fit` | `cover` (default), `contain`, `fill` |
| `format` | Output format (`webp`, `jpeg`, `png`) |
| `q` | Quality (1–100, default 80) |

## Storage backends

- **Local filesystem** (default): files stored in `MEDIA_DIR` (default `./media`)
- **S3**: set `S3_BUCKET` to enable; files stored in S3 bucket under `media/` prefix
