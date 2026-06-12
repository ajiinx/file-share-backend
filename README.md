# Media Share Backend

Node.js/Express API for the media share application.

## Stack

- Node.js 20+
- Express
- MongoDB via Mongoose
- Multer for uploads
- Helmet, CORS, and rate limiting for basic hardening

## Environment

Create a `.env` file from `.env.example`:

```env
PORT=8081
NODE_ENV=production
MONGO_URI=mongodb://localhost:27017/media-share
APP_PUBLIC_BASE_URL=http://localhost:5173
APP_API_BASE_URL=http://localhost:8081
APP_STORAGE_LOCAL_ROOT=uploads
APP_MAX_FILE_SIZE=10485760
APP_CLEANUP_CRON=0 */2 * * * *
```

## Run

```bash
npm install
npm run dev
```

## Production Checkpoints

- `GET /` returns a basic readiness response.
- `GET /health` returns `{"success":true,"status":"ok"}` for health checks.
- CORS must include the frontend origin via `APP_PUBLIC_BASE_URL`.
- File uploads are capped by `APP_MAX_FILE_SIZE`.
- Cleanup runs on the cron defined by `APP_CLEANUP_CRON`.
