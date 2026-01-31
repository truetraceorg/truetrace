# Civitas - Personal Data Sovereignty Platform

A self-hosted personal data vault where you store all your structured data (medical, financial, legal, identity), control access, and view complete audit trails.

## Features

- **Passwordless Authentication** - WebAuthn passkeys (biometric or security key) - no passwords to remember or leak
- **Unified Data Storage** - Store records across 4 categories: Medical, Financial, Legal, Identity
- **Document Management** - Upload, tag, and organize documents with category filtering
- **Access Control** - Create time-limited access grants with specific scopes
- **Complete Audit Trail** - Every action is logged with timestamp, IP, and metadata
- **Data Export** - Export all your data as JSON or CSV
- **Self-Hosted** - Your data stays on your infrastructure

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: FastAPI (Python) + PostgreSQL
- **Storage**: MinIO (S3-compatible)
- **Auth**: WebAuthn (passkeys) + JWT sessions
- **Deploy**: Docker Compose

## Quick Start

```bash
# Clone and start
docker compose up --build

# Access the app
open http://localhost:8000
```

The app will be available at `http://localhost:8000`. Register with your email and create a passkey using your device's biometric or security key.

## Project Structure

```
civitas/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── db/               # SQLAlchemy models
│   │   ├── routers/          # API endpoints
│   │   ├── main.py           # FastAPI app
│   │   ├── webauthn.py       # WebAuthn helpers
│   │   └── ...
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── auth/             # Auth context & guards
│   │   ├── pages/            # React pages
│   │   ├── lib/              # API client & utilities
│   │   └── ...
│   └── Dockerfile
├── docker-compose.yml
├── Caddyfile
└── .env.example
```

## Data Categories

### Medical
- Medications, vaccinations, lab results, conditions, allergies, procedures

### Financial
- Transactions, accounts, assets, liabilities, tax records, invoices

### Legal
- Contracts, certificates, licenses, insurance policies, property deeds

### Identity
- Personal info, contacts, addresses, relationships, emergency contacts

## API Endpoints

### Authentication (WebAuthn)
- `POST /auth/register/begin` - Start passkey registration
- `POST /auth/register/complete` - Complete registration
- `POST /auth/login/begin` - Start passkey authentication
- `POST /auth/login/complete` - Complete login
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Log out
- `GET /auth/credentials` - List passkeys
- `POST /auth/credentials/add/begin` - Add new passkey
- `DELETE /auth/credentials/{id}` - Remove passkey

### Data Records
- `GET /records` - List records (filter by category, type)
- `POST /records` - Create record
- `PUT /records/{id}` - Update record
- `DELETE /records/{id}` - Delete record

### Documents
- `GET /documents` - List documents (filter by category, tag)
- `POST /documents/upload` - Upload document with tags
- `GET /documents/{id}` - Download document
- `DELETE /documents/{id}` - Delete document

### Access Control
- `GET /access-grants` - List grants
- `POST /access-grants` - Create grant
- `PUT /access-grants/{id}/revoke` - Revoke grant

### Export
- `GET /export/json` - Export all data as JSON
- `GET /export/csv` - Export records as CSV

### Other
- `GET /audit` - View audit log
- `GET /stats` - Dashboard statistics

## Environment Variables

See `.env.example` for all configuration options:

```bash
# WebAuthn (required for production)
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_RP_NAME=Civitas
WEBAUTHN_ORIGIN=https://yourdomain.com

# Database
DATABASE_URL=postgresql+psycopg://...

# JWT
JWT_SECRET=your-secret-key

# S3 Storage
S3_ENDPOINT_URL=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=civitas
```

## Security Notes

- **HTTPS Required**: WebAuthn requires a secure context. For local development, `localhost` works as an exception.
- **Passkeys**: Phishing-resistant, no passwords stored on server
- **Per-User Isolation**: All queries are scoped to the authenticated user
- **Audit Everything**: Every action is logged with timestamp, IP, and metadata
- **File Validation**: Uploads are validated for type and size

## Development

```bash
# Backend only
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend only
cd frontend
npm install
npm run dev

# Full stack with Docker
docker compose up --build
```

## License

MIT
