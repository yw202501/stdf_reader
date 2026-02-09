"""STDF 文件相关路由"""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, Query

from ..services.stdf_parser import StdfParserService
from ..models.stdf_models import (
    FileListResponse,
    StdfSummaryResponse,
    TestResultsResponse,
    WaferMapResponse,
    ParseJobStartResponse,
    ParseProgressResponse,
)

router = APIRouter()

# STDF 数据文件目录
DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"

parser_service = StdfParserService()


@router.get("/files", response_model=FileListResponse)
async def list_stdf_files():
    """列出 data 目录下所有的 STDF 文件"""
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    files = []
    for f in DATA_DIR.iterdir():
        if f.suffix.lower() in (".stdf", ".std"):
            files.append(
                {
                    "name": f.name,
                    "size": f.stat().st_size,
                    "modified": f.stat().st_mtime,
                }
            )
    return FileListResponse(files=files)


@router.post("/upload")
async def upload_stdf_file(file: UploadFile = File(...)):
    """上传 STDF 文件到 data 目录"""
    if not file.filename.lower().endswith((".stdf", ".std")):
        raise HTTPException(status_code=400, detail="仅支持 .stdf 或 .std 文件")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_path = DATA_DIR / file.filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return {"message": f"文件 {file.filename} 上传成功", "filename": file.filename}


@router.post("/parse/{filename}", response_model=ParseJobStartResponse)
async def start_parse_job(filename: str):
    """启动 STDF 文件解析任务"""
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件 {filename} 不存在")

    job = parser_service.start_parse(str(file_path))
    return ParseJobStartResponse(
        job_id=job["job_id"],
        status=job["status"],
        percent=job["percent"],
        filename=job["filename"],
    )


@router.get("/progress/{job_id}", response_model=ParseProgressResponse)
async def get_parse_progress(job_id: str):
    """获取解析进度"""
    job = parser_service.get_progress(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="解析任务不存在")

    return ParseProgressResponse(
        job_id=job["job_id"],
        status=job["status"],
        percent=job["percent"],
        filename=job["filename"],
        error=job.get("error"),
    )


@router.get("/summary/{filename}", response_model=StdfSummaryResponse)
async def get_stdf_summary(filename: str):
    """获取 STDF 文件的摘要信息 (MIR/MRR 等)"""
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件 {filename} 不存在")

    try:
        summary = parser_service.get_summary(str(file_path))
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析文件失败: {str(e)}")


@router.get("/results/{filename}", response_model=TestResultsResponse)
async def get_test_results(
    filename: str,
    test_num: Optional[int] = Query(None, description="筛选特定测试编号"),
    site_num: Optional[int] = Query(None, description="筛选特定站点"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(100, ge=1, le=5000, description="每页数量"),
):
    """获取 STDF 文件的测试结果数据"""
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件 {filename} 不存在")

    try:
        results = parser_service.get_test_results(
            str(file_path),
            test_num=test_num,
            site_num=site_num,
            page=page,
            page_size=page_size,
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析文件失败: {str(e)}")


@router.get("/wafermap/{filename}", response_model=WaferMapResponse)
async def get_wafer_map(filename: str):
    """获取 Wafer Map 数据"""
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件 {filename} 不存在")

    try:
        wafer_data = parser_service.get_wafer_map(str(file_path))
        return wafer_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析文件失败: {str(e)}")


@router.get("/test-list/{filename}")
async def get_test_list(filename: str):
    """获取文件中所有测试项列表"""
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"文件 {filename} 不存在")

    try:
        tests = parser_service.get_test_list(str(file_path))
        return {"tests": tests}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析文件失败: {str(e)}")
