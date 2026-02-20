"""Experimental 路由"""

from fastapi import APIRouter

router = APIRouter()


@router.get("")
@router.get("/")
async def experimental_root():
    """Experimental 命名空间健康检查"""
    return {"message": "Experimental endpoint is enabled"}
