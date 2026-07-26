from __future__ import annotations

from fastapi import FastAPI

from .mcp import router as mcp_router
from .mcp import samba_tools
from .routers import account, admin, auth, instance
from .services.config import router as config_router
from .services.samba import router as samba_router
from .services.usage import router as usage_router


def create_app() -> FastAPI:
    # Same-origin behind Caddy → no CORS. Docs disabled (not a public API).
    app = FastAPI(title="Holistic API", docs_url=None, redoc_url=None, openapi_url=None)
    app.include_router(auth.router)
    app.include_router(account.router)
    app.include_router(admin.router)
    app.include_router(instance.router)
    app.include_router(samba_router.router)
    app.include_router(config_router.router)
    app.include_router(usage_router.router)
    # MCP is backend-only (no dashboard tab): every service registers its capabilities as tools,
    # served through the one central /api/mcp endpoint, each gated by the rights system.
    samba_tools.register_all()
    app.include_router(mcp_router.router)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    return app


app = create_app()
