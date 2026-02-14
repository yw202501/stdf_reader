"""数据库缓存服务"""

import json
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

from sqlalchemy.orm import Session

from ..models.db_models import STDFFile, STDFData


def calculate_file_hash(file_path: str) -> str:
    """计算文件的 SHA256 哈希值"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # 分块读取，避免大文件占用过多内存
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


class CacheService:
    """缓存管理服务"""

    @staticmethod
    def get_cached_file_by_hash(db: Session, file_hash: str) -> Optional[STDFFile]:
        """根据哈希值获取缓存的文件记录"""
        return db.query(STDFFile).filter(STDFFile.file_hash == file_hash).first()

    @staticmethod
    def get_cached_data(db: Session, file_id: int, data_type: str) -> Optional[Dict[str, Any]]:
        """获取缓存的解析数据"""
        data_record = (
            db.query(STDFData)
            .filter(STDFData.file_id == file_id, STDFData.data_type == data_type)
            .first()
        )
        if data_record:
            # 更新最后访问时间
            file_record = db.query(STDFFile).filter(STDFFile.id == file_id).first()
            if file_record:
                file_record.last_accessed = datetime.utcnow()
                db.commit()
            
            return json.loads(data_record.data_json)
        return None

    @staticmethod
    def save_file_record(
        db: Session,
        file_hash: str,
        filename: str,
        file_size: int,
        parse_time: Optional[float] = None,
    ) -> STDFFile:
        """保存或更新文件记录"""
        # 检查是否已存在
        existing = CacheService.get_cached_file_by_hash(db, file_hash)
        if existing:
            existing.filename = filename
            existing.last_accessed = datetime.utcnow()
            if parse_time is not None:
                existing.parse_time = parse_time
            db.commit()
            db.refresh(existing)
            return existing

        # 创建新记录
        file_record = STDFFile(
            file_hash=file_hash,
            filename=filename,
            file_size=file_size,
            parse_time=parse_time,
        )
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        return file_record

    @staticmethod
    def save_data(db: Session, file_id: int, data_type: str, data: Dict[str, Any]) -> STDFData:
        """保存解析数据"""
        # 先删除旧数据（如果存在）
        db.query(STDFData).filter(
            STDFData.file_id == file_id, STDFData.data_type == data_type
        ).delete()

        # 保存新数据
        data_record = STDFData(
            file_id=file_id,
            data_type=data_type,
            data_json=json.dumps(data, ensure_ascii=False),
        )
        db.add(data_record)
        db.commit()
        db.refresh(data_record)
        return data_record

    @staticmethod
    def list_cached_files(db: Session, limit: int = 100, offset: int = 0) -> List[STDFFile]:
        """列出所有缓存的文件"""
        return (
            db.query(STDFFile)
            .order_by(STDFFile.last_accessed.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    @staticmethod
    def delete_file_cache(db: Session, file_id: int) -> bool:
        """删除指定文件的缓存"""
        file_record = db.query(STDFFile).filter(STDFFile.id == file_id).first()
        if file_record:
            db.delete(file_record)
            db.commit()
            return True
        return False

    @staticmethod
    def clear_all_cache(db: Session) -> int:
        """清空所有缓存"""
        count = db.query(STDFFile).count()
        db.query(STDFFile).delete()
        db.commit()
        return count

    @staticmethod
    def get_cache_stats(db: Session) -> Dict[str, Any]:
        """获取缓存统计信息"""
        from sqlalchemy import func
        
        total_files = db.query(STDFFile).count()
        total_data_records = db.query(STDFData).count()
        total_size = db.query(func.sum(STDFFile.file_size)).scalar() or 0

        return {
            "total_cached_files": total_files,
            "total_data_records": total_data_records,
            "total_file_size": total_size,
        }
