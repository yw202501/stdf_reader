"""数据库 ORM 模型"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from ..database import Base


class STDFFile(Base):
    """STDF 文件表"""
    __tablename__ = "stdf_files"

    id = Column(Integer, primary_key=True, index=True)
    file_hash = Column(String(64), unique=True, index=True, nullable=False)  # SHA256 哈希
    filename = Column(String(255), nullable=False)  # 原始文件名
    file_size = Column(Integer, nullable=False)  # 文件大小（字节）
    upload_time = Column(DateTime, default=datetime.utcnow, nullable=False)  # 上传时间
    parse_time = Column(Float, nullable=True)  # 解析耗时（秒）
    last_accessed = Column(DateTime, default=datetime.utcnow, nullable=False)  # 最后访问时间

    # 关联关系
    data = relationship("STDFData", back_populates="file", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<STDFFile(id={self.id}, filename={self.filename}, hash={self.file_hash[:8]}...)>"


class STDFData(Base):
    """STDF 解析数据表"""
    __tablename__ = "stdf_data"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("stdf_files.id", ondelete="CASCADE"), nullable=False)
    data_type = Column(String(50), nullable=False)  # 数据类型: summary, wafer_map, test_data, test_list
    data_json = Column(Text, nullable=False)  # JSON 格式的数据
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # 关联关系
    file = relationship("STDFFile", back_populates="data")

    # 复合索引
    __table_args__ = (
        Index('ix_file_type', 'file_id', 'data_type'),
    )

    def __repr__(self):
        return f"<STDFData(id={self.id}, file_id={self.file_id}, type={self.data_type})>"
