# Local Frontend-Backend-DB Linkup

This guide makes the local chain work end-to-end:
`Frontend -> Backend API -> MySQL/Redis`.

## 1. Start DB and cache

```bash
docker compose up -d mysql redis
```

## 2. Initialize schema

```bash
mysql -h 127.0.0.1 -uroot -p yibin_youth_festival < database/schema.sql
```

Database name must be `yibin_youth_festival` (already aligned in `docker-compose.yml`).

## 3. Start backend

```bash
cd server
cp .env.example .env
npm ci
npm run dev
```

Important local env values in `server/.env`:

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=yibin_youth_festival`
- `DB_USER=root` (or your app user)
- `DB_PASSWORD=<your_password>`
- `REDIS_HOST=127.0.0.1`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD=<your_redis_password>`
- `JWT_SECRET=<at least 24 chars>`
- `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

## 4. Create admin account

```bash
cd server
npm run create:admin -- admin StrongPass#2026
```

## 5. Start admin frontend

```bash
cd admin
npm ci
npm run dev
```

Admin dev server now proxies `/api/*` to backend (`http://127.0.0.1:3000` by default).
You can override target with:

```bash
VITE_PROXY_TARGET=http://127.0.0.1:3000 npm run dev
```

## 6. Verify linkup

- Open `http://localhost:5173`
- Login with the admin account from step 4
- Check dashboard/user/coupon pages and confirm data updates in MySQL
- Backend readiness check: `http://127.0.0.1:3000/ready`

