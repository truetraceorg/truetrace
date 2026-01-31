from __future__ import annotations

from fastapi import FastAPI

from app.routers.access_grants import router as access_grants_router
from app.routers.auth import router as auth_router
from app.routers.audit import router as audit_router
from app.routers.documents import router as documents_router
from app.routers.export import router as export_router
from app.routers.financial import router as financial_router
from app.routers.medical import router as medical_router
from app.routers.stats import router as stats_router

app = FastAPI(title="MedVault API", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(auth_router)
app.include_router(access_grants_router)
app.include_router(audit_router)
app.include_router(documents_router)
app.include_router(export_router)
app.include_router(financial_router)
app.include_router(medical_router)
app.include_router(stats_router)

