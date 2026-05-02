# mini-distributed-job-api
> Prototype 1 — May 1, 2026

A backend job processing service. Accepts tasks via REST API, processes them asynchronously via a background worker, retries on failure, and dead-letters jobs that exceed max attempts.

**Stack:** Node.js · TypeScript · Express · PostgreSQL · Redis · Docker

---

## How it works

```
POST /jobs → saves to PostgreSQL → pushes ID to Redis
Worker     → BRPOP from Redis → processes job → updates status
```

**Job lifecycle:** `PENDING → PROCESSING → SUCCESS / FAILED → DEAD_LETTER`

---

## API

```
POST   /jobs                          submit a job
GET    /jobs/:id                      poll status
GET    /jobs?limit=10                 list jobs (cursor paginated)
GET    /jobs?status=PENDING           filter by status
GET    /jobs?limit=10&cursor=<ts>     next page
GET    /health                        health check
```

---

## Run it

```bash
docker-compose up --build
```

Or locally:
```bash
docker-compose up -d postgres redis
npm run dev
npx tsx src/worker.ts
```

---

## .env

```
DATABASE_URL=postgresql://postgres:password@localhost:5433/mydb
REDIS_URL=redis://localhost:6379
PORT=3000
```
