# MedVault (Self‑Hosted Medical Data Vault)

MedVault is a self-hosted medical records management system where users can:
- Register/login (JWT)
- Create/read/update/delete medical records (medications, vaccinations, labs, conditions, allergies)
- Upload/download/delete documents (PDF/JPG/PNG) stored in MinIO (S3)
- Create/revoke access grants (UI-only MVP)
- View a complete audit log of actions
- Export data as JSON and **minimal** best-effort FHIR Bundle
- Add a demo financial transaction (modularity example)

## Quick start (Docker Compose)

1. Copy env:

```bash
cp .env.example .env
```

2. Start everything:

```bash
docker compose up -d --build
```

3. Open the app:
- **Web app**: `http://localhost:8000`
- **MinIO API**: `http://localhost:9000`
- **MinIO Console**: `http://localhost:9001`

## Project structure

- `frontend/`: React + Vite + Tailwind UI
- `backend/`: FastAPI + SQLAlchemy + Alembic + JWT
- `docker-compose.yml`: Postgres + MinIO + backend + frontend + Caddy (single origin)
- `Caddyfile`: routes `/api/*` → backend, everything else → frontend

## Notes

- **Audit logging**: Create/read/update/delete, uploads/downloads/deletes, exports, stats reads, etc. are logged to `audit_log`.
- **File uploads**: Validates type (PDF/JPG/PNG) and size (defaults to 10MB, configurable via `MAX_UPLOAD_BYTES`).
- **FHIR export**: Minimal/best-effort mapping for meds/vaccinations/labs. Not guaranteed compliant/validated.
