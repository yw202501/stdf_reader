"""STDF 数据模型"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ========== 文件列表 ==========

class FileInfo(BaseModel):
    name: str
    size: int
    modified: float


class FileListResponse(BaseModel):
    files: List[FileInfo]


# ========== MIR / MRR 信息 ==========

class MirInfo(BaseModel):
    setup_time: str = ""
    start_time: str = ""
    station_number: int = 0
    mode_code: str = ""
    lot_id: str = ""
    part_type: str = ""
    node_name: str = ""
    tester_type: str = ""
    job_name: str = ""
    exec_type: str = ""
    exec_ver: str = ""
    facility_id: str = ""
    floor_id: str = ""
    process_id: str = ""


class MrrInfo(BaseModel):
    finish_time: str = ""
    disposition_code: str = ""
    user_description: str = ""
    exec_description: str = ""


# ========== 摘要 ==========

class SiteYield(BaseModel):
    site_num: int
    total_parts: int = 0
    pass_count: int = 0
    fail_count: int = 0
    yield_rate: float = 0.0


class HardBinInfo(BaseModel):
    bin_num: int
    count: int
    percent: float
    failed_tests: List[str] = []  # 该bin对应的失败测试项名称


class StdfSummaryResponse(BaseModel):
    summary_version: int = 2
    mir: Optional[MirInfo] = None
    mrr: Optional[MrrInfo] = None
    total_parts: int = 0
    pass_count: int = 0
    fail_count: int = 0
    yield_rate: float = 0.0
    sites: List[int] = []
    site_yields: List[SiteYield] = []
    hbin_counts: Dict[int, int] = {}
    hbin_details: List[HardBinInfo] = []  # 新增：详细的bin信息
    total_tests: int = 0


# ========== 测试结果 ==========

class TestResultItem(BaseModel):
    test_num: int
    head_num: int = 0
    site_num: int = 0
    test_flag: int = 0
    result: float = 0.0
    test_txt: str = ""
    lo_limit: Optional[float] = None
    hi_limit: Optional[float] = None
    units: str = ""


class TestResultsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[TestResultItem]


# ========== 测试列表 ==========

class TestInfo(BaseModel):
    test_num: int
    test_txt: str = ""
    units: str = ""
    lo_limit: Optional[float] = None
    hi_limit: Optional[float] = None
    count: int = 0
    fail_rate: float = 0.0


# ========== Wafer Map ==========

class DieResult(BaseModel):
    x_coord: int
    y_coord: int
    hard_bin: int
    soft_bin: int
    part_flag: int = 0
    site_num: int = 0


class WaferMapResponse(BaseModel):
    wafer_id: str = ""
    total_dies: int = 0
    dies: List[DieResult] = []


# ========== 解析进度 ==========

class ParseJobStartResponse(BaseModel):
    job_id: str
    status: str
    percent: int
    filename: str


class ParseProgressResponse(BaseModel):
    job_id: str
    status: str
    percent: int
    filename: str
    error: Optional[str] = None
