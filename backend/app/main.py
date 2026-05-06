"""FastAPI 主入口"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import stdf, cache, experimental
from .database import init_db


def _get_allowed_origins() -> list[str]:
    cors_origins = os.getenv("CORS_ORIGINS")
    if cors_origins:
        return [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

    return [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ]

app = FastAPI(
    title="STDF Reader API",
    description="STDF 文件解析与分析 API",
    version="1.0.0",
)

# CORS 配置，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化数据库
init_db()

# 注册路由
app.include_router(stdf.router, prefix="/api/stdf", tags=["STDF"])
app.include_router(cache.router, prefix="/api/cache", tags=["Cache"])
app.include_router(experimental.router, prefix="/experimental", tags=["Experimental"])


@app.get("/")
async def root():
    return {"message": "STDF Reader API is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
