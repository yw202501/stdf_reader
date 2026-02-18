"""FastAPI 主入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import stdf, cache
from .database import init_db

app = FastAPI(
    title="STDF Reader API",
    description="STDF 文件解析与分析 API",
    version="1.0.0",
)

# CORS 配置，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化数据库
init_db()

# 注册路由
app.include_router(stdf.router, prefix="/api/stdf", tags=["STDF"])
app.include_router(cache.router, prefix="/api/cache", tags=["Cache"])


@app.get("/")
async def root():
    return {"message": "STDF Reader API is running"}
