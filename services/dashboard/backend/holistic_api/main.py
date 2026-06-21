from __future__ import annotations

from fastapi import FastAPI

from .routers import account, admin, auth, instance
from .services.samba import router as samba_router


def create_app() -> FastAPI:
    # Same-origin behind Caddy → no CORS. Docs disabled (not a public API).
    app = FastAPI(title="Holistic API", docs_url=None, redoc_url=None, openapi_url=None)
    app.include_router(auth.router)
    app.include_router(account.router)
    app.include_router(admin.router)
    app.include_router(instance.router)
    app.include_router(samba_router.router)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    return app


app = create_app()
