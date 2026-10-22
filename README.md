# PulseGuard - API Health & Webhook Alerting Platform

Real-time API uptime monitor, ping latency tracker, and webhook inspection service.

---

## Architecture Overview

PulseGuard run as client-server monorepo. React frontend talk to Express API. Polling engine check configured endpoints at target intervals.

```
+-------------------------------------------------------+
|                   PulseGuard Web UI                   |
|       (React 18 + TypeScript + Tailwind CSS)          |
+---------------------------+---------------------------+
                            | HTTP / REST
                            v
+-------------------------------------------------------+
|                  Express Backend API                  |
|                 (Node.js + TypeScript)                |
+-------------+---------------------------+-------------+
              |                           |
              v                           v
+---------------------------+ +-------------------------+
|      Scheduler Engine     | |   In-Memory Store       |
|    (Node-interval jobs)   | |  (Monitors, Logs, Hits) |
+-------------+-------------+ +-------------------------+
              |
              v
+---------------------------+
|    Checker Service        |
|  - Axios ping probe       |
|  - Latency measurement    |
|  - Webhook dispatch       |
+---------------------------+
```

### Components

- `server/src/index.ts`: Entry point. Mount API routes, initialize storage, boot check scheduler.
- `server/src/routes/api.ts`: Route handlers for monitors CRUD, webhook ingestion, manual checks, stats.
- `server/src/services/store.ts`: Thread-safe runtime store for monitor configurations, check results, incident states.
- `server/src/services/checker.ts`: Perform HTTP probes, compute response latencies, evaluate assertion rules, fire alert webhooks on status transitions.
- `server/src/services/scheduler.ts`: Interval loop runner. Dispatch health check batches based on monitor frequency.
- `client/src/App.tsx`: Dashboard dashboard layout, real-time polling hook, metric summary cards.
- `client/src/components/MonitorCard.tsx`: Individual monitor state, uptime percent, trigger check button, delete action.
- `client/src/components/LatencyChart.tsx`: SVG latency visualizer for historical response times.
- `client/src/components/AddMonitorModal.tsx`: Creation modal for target URL, method, interval, alert webhook.

---

## API Documentation

Base path: `/api`

### 1. List Monitors
Fetch all monitors with recent check logs.

- **URL:** `GET /api/monitors`
- **Response:** `200 OK`
```json
[
  {
    "id": "mon_98374281",
    "name": "Production Auth API",
    "url": "https://auth.example.com/health",
    "method": "GET",
    "interval": 60,
    "status": "up",
    "uptime": 99.95,
    "lastCheck": "2025-02-15T08:30:00.000Z",
    "latency": 45,
    "alertWebhookUrl": "https://hooks.slack.com/services/xxx",
    "history": [
      {
        "timestamp": "2025-02-15T08:30:00.000Z",
        "status": 200,
        "latency": 45,
        "ok": true
      }
    ]
  }
]
```

### 2. Create Monitor
Register new endpoint for polling.

- **URL:** `POST /api/monitors`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "name": "Payment Gateway Ping",
  "url": "https://pay.example.com/status",
  "method": "GET",
  "interval": 30,
  "alertWebhookUrl": "https://api.opsgenie.com/v1/json/webhook"
}
```
- **Response:** `201 Created` returns monitor object.

### 3. Trigger Manual Ping
Force immediate check on single monitor.

- **URL:** `POST /api/monitors/:id/check`
- **Response:** `200 OK`
```json
{
  "monitorId": "mon_98374281",
  "status": 200,
  "latency": 52,
  "ok": true,
  "timestamp": "2025-02-15T08:32:10.000Z"
}
```

### 4. Delete Monitor
Remove monitor and stop scheduled checks.

- **URL:** `DELETE /api/monitors/:id`
- **Response:** `204 No Content`

### 5. Webhook Ingestion Probe
Inspect incoming webhook payload, measure ingress status.

- **URL:** `POST /api/webhooks/incoming/:hookId`
- **Headers:** `Content-Type: application/json`
- **Body:** Arbitrary JSON payload
- **Response:** `200 OK`
```json
{
  "received": true,
  "hookId": "hook_123",
  "timestamp": "2025-02-15T08:35:00.000Z",
  "payloadSize": 128
}
```

---

## Local Run Instructions

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x

### Setup

1. Clone repo:
```bash
git clone https://github.com/org/pulseguard.git
cd pulseguard
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create `.env` file in root:
```env
PORT=3001
VITE_API_URL=http://localhost:3001
NODE_ENV=development
```

4. Run development mode (concurrent client and server):
```bash
npm run dev
```

5. Access applications:
- Client UI: `http://localhost:5173`
- Express Backend: `http://localhost:3001`
- Backend Health Check: `http://localhost:3001/api/health`

### Build for Production
```bash
# Type check and build bundles
npm run build

# Start production server
npm run start
```

---

## Deployment Guide

### Option 1: Single Container (Docker)

Create `Dockerfile` in root:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
EXPOSE 3001
CMD ["node", "dist/server/index.js"]
```

Build and run:
```bash
docker build -t pulseguard:latest .
docker run -d -p 3001:3001 --env PORT=3001 --name pulseguard pulseguard:latest
```

### Option 2: Linux Virtual Machine (Systemd + PM2)

1. Provision server running Ubuntu 22.04 LTS.
2. Install Node.js runtime and PM2 process manager:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
```

3. Deploy code to `/var/www/pulseguard`:
```bash
git clone <repo-url> /var/www/pulseguard
cd /var/www/pulseguard
npm install
npm run build
```

4. Run backend under PM2:
```bash
pm2 start dist/server/index.js --name "pulseguard-api"
pm2 save
pm2 startup
```

5. Configure Nginx reverse proxy:
Write `/etc/nginx/sites-available/pulseguard`:
```nginx
server {
    listen 80;
    server_name pulseguard.example.com;

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        root /var/www/pulseguard/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

6. Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/pulseguard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

7. Install SSL certificate via Certbot:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pulseguard.example.com
```

### Option 3: PaaS (Render, Railway, Fly.io)

- **Root Directory:** `/`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`
- **Environment Variables:**
  - `NODE_ENV=production`
  - `PORT=3001`
  - Serve frontend static build directly through Express via `express.static('client/dist')` or point frontend static site host to `client/dist`.