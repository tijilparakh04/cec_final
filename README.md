# CEC Project

This repo contains 3 runnable parts:

- **Admin dashboard**: `admin-dashboard/`
- **User frontend**: `frontend/`
- **Backend API**: `backend/`

Each part is started separately (all use `npm run dev` for the frontends; the backend uses `node index.js`).

---

## 1) Prerequisites

- **Node.js** (LTS recommended)
- **PostgreSQL**

---

## 2) Install dependencies

Run this in each folder:

### Admin dashboard
```bash
cd admin-dashboard
npm install
```

### User frontend
```bash
cd frontend
npm install
```

### Backend
```bash
cd backend
npm install
```

---

## 3) Configure environment variables (Backend)

Edit:

- `backend/.env`

It must define at least these fields:

- `DATABASE_URL` — Postgres connection string
- `PORT` — backend port to listen on
- `ADMIN_JWT_SECRET` — secret used to sign/verify admin JWTs

> Note: `backend/.env` is backend-only. The frontends are usually configured to call the backend via Vite config / runtime URLs.

---

## 4) Run the app

### Backend (API)
From `backend/`:
```bash
cd backend
node index.js
```

### Admin dashboard
From `admin-dashboard/`:
```bash
cd admin-dashboard
npm run dev
```

### User frontend
From `frontend/`:
```bash
cd frontend
npm run dev
```
---

## Notes

There is additional admin setup documentation here:
- `admin-dashboard/README_ADMIN_SETUP.md`


