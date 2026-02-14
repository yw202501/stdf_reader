"""缓存管理路由"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..services.cache_service import CacheService


router = APIRouter()


# ========== 响应模型 ==========

class CachedFileInfo(BaseModel):
    id: int
    file_hash: str
    filename: str
    file_size: int
    upload_time: str
    parse_time: float
    last_accessed: str

    class Config:
        from_attributes = True


class CacheStatsResponse(BaseModel):
    total_cached_files: int
    total_data_records: int
    total_file_size: int


class CachedFileListResponse(BaseModel):
    files: List[CachedFileInfo]
    total: int


# ========== 路由 ==========

@router.get("/stats", response_model=CacheStatsResponse)
async def get_cache_stats(db: Session = Depends(get_db)):
    """获取缓存统计信息"""
    stats = CacheService.get_cache_stats(db)
    return CacheStatsResponse(**stats)


@router.get("/files", response_model=CachedFileListResponse)
async def list_cached_files(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """列出所有缓存的文件"""
    from ..models.db_models import STDFFile
    
    files = CacheService.list_cached_files(db, limit=limit, offset=offset)
    total = db.query(STDFFile).count()
    
    file_list = []
    for f in files:
        file_list.append(CachedFileInfo(
            id=f.id,
            file_hash=f.file_hash,
            filename=f.filename,
            file_size=f.file_size,
            upload_time=f.upload_time.isoformat(),
            parse_time=f.parse_time or 0.0,
            last_accessed=f.last_accessed.isoformat(),
        ))
    
    return CachedFileListResponse(files=file_list, total=total)


@router.delete("/files/{file_id}")
async def delete_cached_file(file_id: int, db: Session = Depends(get_db)):
    """删除指定文件的缓存"""
    success = CacheService.delete_file_cache(db, file_id)
    if not success:
        raise HTTPException(status_code=404, detail="缓存文件不存在")
    return {"message": "缓存已删除", "file_id": file_id}


@router.delete("/clear")
async def clear_all_cache(db: Session = Depends(get_db)):
    """清空所有缓存"""
    count = CacheService.clear_all_cache(db)
    return {"message": f"已清空 {count} 个缓存文件"}
