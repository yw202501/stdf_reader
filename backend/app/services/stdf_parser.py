"""STDF 文件解析服务"""

import os
import threading
import uuid
from typing import Dict, List, Optional

from pystdf.IO import Parser
from pystdf import V4

from ..models.stdf_models import (
    StdfSummaryResponse,
    TestResultsResponse,
    WaferMapResponse,
    TestResultItem,
    TestInfo,
    DieResult,
    MirInfo,
    MrrInfo,
    SiteYield,
    HardBinInfo,
)


class StdfRecordCollector:
    """STDF 记录收集器，配合 pystdf 使用"""

    def __init__(self):
        self.mir: Optional[Dict] = None
        self.mrr: Optional[Dict] = None
        self.ptr_list: List[Dict] = []
        self.ftr_list: List[Dict] = []
        self.prr_list: List[Dict] = []
        self.pir_list: List[Dict] = []
        self.wrr_list: List[Dict] = []
        self.wir_list: List[Dict] = []
        self.tsr_list: List[Dict] = []
        self.hbr_list: List[Dict] = []
        self.sbr_list: List[Dict] = []
        self.far: Optional[Dict] = None

    def after_send(self, dataSource, data):
        """pystdf 回调 - 收集记录"""
        record_obj, field_values = data
        record = dict(zip(record_obj.columnNames, field_values))

        if isinstance(record_obj, V4.Mir):
            self.mir = record
        elif isinstance(record_obj, V4.Mrr):
            self.mrr = record
        elif isinstance(record_obj, V4.Ptr):
            self.ptr_list.append(record)
        elif isinstance(record_obj, V4.Ftr):
            self.ftr_list.append(record)
        elif isinstance(record_obj, V4.Prr):
            self.prr_list.append(record)
        elif isinstance(record_obj, V4.Pir):
            self.pir_list.append(record)
        elif isinstance(record_obj, V4.Wrr):
            self.wrr_list.append(record)
        elif isinstance(record_obj, V4.Wir):
            self.wir_list.append(record)
        elif isinstance(record_obj, V4.Tsr):
            self.tsr_list.append(record)
        elif isinstance(record_obj, V4.Hbr):
            self.hbr_list.append(record)
        elif isinstance(record_obj, V4.Sbr):
            self.sbr_list.append(record)
        elif isinstance(record_obj, V4.Far):
            self.far = record


class StdfParserService:
    """STDF 解析服务"""

    def __init__(self):
        self._cache: Dict[str, Dict] = {}
        self._jobs: Dict[str, Dict] = {}
        self._job_by_file: Dict[str, str] = {}
        self._lock = threading.Lock()

    def _get_signature(self, file_path: str) -> str:
        stat = os.stat(file_path)
        return f"{stat.st_size}:{stat.st_mtime}"

    def _get_cached_collector(self, file_path: str) -> Optional[StdfRecordCollector]:
        signature = self._get_signature(file_path)
        with self._lock:
            cached = self._cache.get(file_path)
            if cached and cached.get("signature") == signature:
                return cached.get("collector")
        return None

    def _set_cache(self, file_path: str, collector: StdfRecordCollector) -> None:
        signature = self._get_signature(file_path)
        with self._lock:
            self._cache[file_path] = {
                "signature": signature,
                "collector": collector,
            }

    def _parse_file(self, file_path: str, on_progress=None) -> StdfRecordCollector:
        """解析 STDF 文件并返回收集器"""

        class ProgressFile:
            def __init__(self, file_obj, total_bytes, on_progress_cb):
                self._file = file_obj
                self._total = total_bytes
                self._read = 0
                self._on_progress = on_progress_cb

            def read(self, size=-1):
                data = self._file.read(size)
                if data:
                    self._read += len(data)
                    if self._total > 0 and self._on_progress:
                        percent = int(self._read * 100 / self._total)
                        percent = min(max(percent, 0), 99)
                        self._on_progress(percent)
                return data

            def close(self):
                return self._file.close()

            def __getattr__(self, name):
                return getattr(self._file, name)

        collector = StdfRecordCollector()
        total_bytes = os.path.getsize(file_path)
        with open(file_path, "rb") as raw_file:
            file_obj = ProgressFile(raw_file, total_bytes, on_progress) if on_progress else raw_file
            parser = Parser(inp=file_obj)
            parser.addSink(collector)
            parser.parse()
        return collector

    def _run_parse_job(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            file_path = job["file_path"]
            job["status"] = "running"
            job["percent"] = 0

        def update_progress(value: int) -> None:
            with self._lock:
                current = self._jobs.get(job_id)
                if not current:
                    return
                current["percent"] = max(current.get("percent", 0), value)

        try:
            collector = self._parse_file(file_path, on_progress=update_progress)
            self._set_cache(file_path, collector)
            with self._lock:
                current = self._jobs.get(job_id)
                if current:
                    current["status"] = "done"
                    current["percent"] = 100
        except Exception as exc:
            with self._lock:
                current = self._jobs.get(job_id)
                if current:
                    current["status"] = "error"
                    current["error"] = str(exc)

    def start_parse(self, file_path: str) -> Dict:
        cached = self._get_cached_collector(file_path)
        if cached:
            job_id = str(uuid.uuid4())
            with self._lock:
                self._jobs[job_id] = {
                    "job_id": job_id,
                    "file_path": file_path,
                    "filename": os.path.basename(file_path),
                    "status": "done",
                    "percent": 100,
                    "error": None,
                }
            return self._jobs[job_id]

        with self._lock:
            existing_job_id = self._job_by_file.get(file_path)
            if existing_job_id:
                existing_job = self._jobs.get(existing_job_id)
                if existing_job and existing_job.get("status") in {"running", "pending"}:
                    return existing_job

            job_id = str(uuid.uuid4())
            self._jobs[job_id] = {
                "job_id": job_id,
                "file_path": file_path,
                "filename": os.path.basename(file_path),
                "status": "pending",
                "percent": 0,
                "error": None,
            }
            self._job_by_file[file_path] = job_id

        thread = threading.Thread(target=self._run_parse_job, args=(job_id,), daemon=True)
        thread.start()
        return self._jobs[job_id]

    def get_progress(self, job_id: str) -> Optional[Dict]:
        with self._lock:
            return self._jobs.get(job_id)

    def get_summary(self, file_path: str) -> StdfSummaryResponse:
        """获取 STDF 文件摘要"""
        collector = self._get_cached_collector(file_path)
        if not collector:
            collector = self._parse_file(file_path)
            self._set_cache(file_path, collector)

        mir_info = None
        if collector.mir:
            mir = collector.mir
            mir_info = MirInfo(
                setup_time=str(mir.get("SETUP_T", "")),
                start_time=str(mir.get("START_T", "")),
                station_number=mir.get("STAT_NUM", 0),
                mode_code=mir.get("MODE_COD", ""),
                lot_id=mir.get("LOT_ID", ""),
                part_type=mir.get("PART_TYP", ""),
                node_name=mir.get("NODE_NAM", ""),
                tester_type=mir.get("TSTR_TYP", ""),
                job_name=mir.get("JOB_NAM", ""),
                exec_type=mir.get("EXEC_TYP", ""),
                exec_ver=mir.get("EXEC_VER", ""),
                facility_id=mir.get("FACIL_ID", ""),
                floor_id=mir.get("FLOOR_ID", ""),
                process_id=mir.get("PROC_ID", ""),
            )

        mrr_info = None
        if collector.mrr:
            mrr = collector.mrr
            mrr_info = MrrInfo(
                finish_time=str(mrr.get("FINISH_T", "")),
                disposition_code=str(mrr.get("DISP_COD", "")),
                user_description=str(mrr.get("USR_DESC", "")),
                exec_description=str(mrr.get("EXC_DESC", "")),
            )

        # 统计信息
        total_parts = len(collector.prr_list)
        pass_count = sum(
            1 for prr in collector.prr_list if prr.get("HARD_BIN", 1) == 1
        )
        fail_count = total_parts - pass_count

        # 站点列表
        sites = sorted(set(prr.get("SITE_NUM", 0) for prr in collector.prr_list))

        # 按site统计yield
        site_yield_map: Dict[int, Dict[str, int]] = {}
        for prr in collector.prr_list:
            site = prr.get("SITE_NUM", 0)
            if site not in site_yield_map:
                site_yield_map[site] = {"total": 0, "pass": 0}
            site_yield_map[site]["total"] += 1
            if prr.get("HARD_BIN", 1) == 1:
                site_yield_map[site]["pass"] += 1

        site_yields = []
        for site in sites:
            stats = site_yield_map.get(site, {"total": 0, "pass": 0})
            total = stats["total"]
            pass_count_site = stats["pass"]
            fail_count_site = total - pass_count_site
            yield_rate_site = round(pass_count_site / total * 100, 2) if total > 0 else 0
            site_yields.append(
                SiteYield(
                    site_num=site,
                    total_parts=total,
                    pass_count=pass_count_site,
                    fail_count=fail_count_site,
                    yield_rate=yield_rate_site,
                )
            )

        # Hard Bin 统计
        hbin_counts: Dict[int, int] = {}
        for prr in collector.prr_list:
            hbin = prr.get("HARD_BIN", 0)
            hbin_counts[hbin] = hbin_counts.get(hbin, 0) + 1

        # 分析每个bin对应的失败测试项
        # 首先建立PTR到HEAD_NUM+SITE_NUM的索引，用于关联同一芯片的测试
        # 由于STDF文件中PTR和PRR按顺序出现，需要按HEAD/SITE分组
        test_name_map: Dict[int, str] = {}  # test_num -> test_name
        for ptr in collector.ptr_list:
            test_num = ptr.get("TEST_NUM", 0)
            test_txt = ptr.get("TEST_TXT", "")
            if test_num not in test_name_map and test_txt:
                test_name_map[test_num] = test_txt

        # 统计每个bin中失败次数最多的测试项
        bin_failed_tests: Dict[int, Dict[str, int]] = {}  # bin -> {test_name: fail_count}
        
        # 按HEAD_NUM和SITE_NUM对PTR分组
        ptr_by_head_site: Dict[tuple, List] = {}
        for ptr in collector.ptr_list:
            head = ptr.get("HEAD_NUM", 255)
            site = ptr.get("SITE_NUM", 0)
            key = (head, site)
            if key not in ptr_by_head_site:
                ptr_by_head_site[key] = []
            ptr_by_head_site[key].append(ptr)

        # 对于非bin1的芯片，找出失败的测试项
        for prr in collector.prr_list:
            hbin = prr.get("HARD_BIN", 0)
            if hbin == 1:  # 跳过通过的芯片
                continue
                
            head = prr.get("HEAD_NUM", 255)
            site = prr.get("SITE_NUM", 0)
            
            # 找到该芯片的测试数据 - 需要更精确的匹配
            # 使用X_COORD和Y_COORD作为唯一标识
            x_coord = prr.get("X_COORD", -1)
            y_coord = prr.get("Y_COORD", -1)
            part_id = prr.get("PART_ID", "")
            
            if hbin not in bin_failed_tests:
                bin_failed_tests[hbin] = {}

        # 使用TSR (Test Synopsis Record) 如果可用
        if collector.tsr_list:
            for tsr in collector.tsr_list:
                test_num = tsr.get("TEST_NUM", 0)
                test_name = tsr.get("TEST_NAM", "") or test_name_map.get(test_num, f"Test {test_num}")
                fail_cnt = tsr.get("FAIL_CNT", 0)
                
                # TSR doesn't have bin info, so we'll associate failed tests with non-pass bins
                if fail_cnt > 0 and test_name:
                    for bin_num in hbin_counts.keys():
                        if bin_num != 1:  # 只关联非pass的bin
                            if bin_num not in bin_failed_tests:
                                bin_failed_tests[bin_num] = {}
                            bin_failed_tests[bin_num][test_name] = bin_failed_tests[bin_num].get(test_name, 0) + fail_cnt
        
        # 如果没有TSR，从PTR推断
        if not collector.tsr_list:
            for ptr in collector.ptr_list:
                test_num = ptr.get("TEST_NUM", 0)
                test_flag = ptr.get("TEST_FLG", 0)
                result = ptr.get("RESULT")
                lo_limit = ptr.get("LO_LIMIT")
                hi_limit = ptr.get("HI_LIMIT")
                test_name = ptr.get("TEST_TXT", "") or f"Test {test_num}"
                
                # 检查是否失败
                is_fail = False
                if test_flag is not None:
                    # TEST_FLG bit 6 (0x40) = 1 表示失败
                    is_fail = (test_flag & 0x40) != 0
                else:
                    # 根据限值判断
                    if result is not None:
                        if lo_limit is not None and result < lo_limit:
                            is_fail = True
                        if hi_limit is not None and result > hi_limit:
                            is_fail = True
                
                if is_fail and test_name:
                    # 将失败测试关联到所有非pass的bin
                    for bin_num in hbin_counts.keys():
                        if bin_num != 1:
                            if bin_num not in bin_failed_tests:
                                bin_failed_tests[bin_num] = {}
                            bin_failed_tests[bin_num][test_name] = bin_failed_tests[bin_num].get(test_name, 0) + 1

        # 构建hbin_details
        hbin_details = []
        for bin_num in sorted(hbin_counts.keys()):
            count = hbin_counts[bin_num]
            percent = round(count / total_parts * 100, 2) if total_parts > 0 else 0
            
            # 获取该bin的top失败测试项（最多5个）
            failed_tests_list = []
            if bin_num in bin_failed_tests:
                sorted_tests = sorted(
                    bin_failed_tests[bin_num].items(),
                    key=lambda x: x[1],
                    reverse=True
                )
                failed_tests_list = [test_name for test_name, _ in sorted_tests[:10]]
            
            hbin_details.append(
                HardBinInfo(
                    bin_num=bin_num,
                    count=count,
                    percent=percent,
                    failed_tests=failed_tests_list,
                )
            )

        return StdfSummaryResponse(
            mir=mir_info,
            mrr=mrr_info,
            total_parts=total_parts,
            pass_count=pass_count,
            fail_count=fail_count,
            yield_rate=round(pass_count / total_parts * 100, 2) if total_parts > 0 else 0,
            sites=sites,
            site_yields=site_yields,
            hbin_counts=hbin_counts,
            hbin_details=hbin_details,
            total_tests=len(set(ptr.get("TEST_NUM", 0) for ptr in collector.ptr_list)),
        )

    def get_test_results(
        self,
        file_path: str,
        test_num: Optional[int] = None,
        site_num: Optional[int] = None,
        page: int = 1,
        page_size: int = 100,
    ) -> TestResultsResponse:
        """获取测试结果数据"""
        collector = self._get_cached_collector(file_path)
        if not collector:
            collector = self._parse_file(file_path)
            self._set_cache(file_path, collector)

        results = []
        for ptr in collector.ptr_list:
            # 筛选
            if test_num is not None and ptr.get("TEST_NUM") != test_num:
                continue
            if site_num is not None and ptr.get("SITE_NUM") != site_num:
                continue

            results.append(
                TestResultItem(
                    test_num=ptr.get("TEST_NUM", 0),
                    head_num=ptr.get("HEAD_NUM", 0),
                    site_num=ptr.get("SITE_NUM", 0),
                    test_flag=ptr.get("TEST_FLG", 0),
                    result=float(ptr.get("RESULT", 0)),
                    test_txt=ptr.get("TEST_TXT", ""),
                    lo_limit=float(ptr.get("LO_LIMIT", 0)) if ptr.get("LO_LIMIT") is not None else None,
                    hi_limit=float(ptr.get("HI_LIMIT", 0)) if ptr.get("HI_LIMIT") is not None else None,
                    units=ptr.get("UNITS", ""),
                )
            )

        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        paged_results = results[start:end]

        return TestResultsResponse(
            total=total,
            page=page,
            page_size=page_size,
            results=paged_results,
        )

    def get_test_list(self, file_path: str) -> List[TestInfo]:
        """获取文件中所有测试项列表"""
        collector = self._get_cached_collector(file_path)
        if not collector:
            collector = self._parse_file(file_path)
            self._set_cache(file_path, collector)

        test_map: Dict[int, TestInfo] = {}
        for ptr in collector.ptr_list:
            tnum = ptr.get("TEST_NUM", 0)
            if tnum not in test_map:
                test_map[tnum] = TestInfo(
                    test_num=tnum,
                    test_txt=ptr.get("TEST_TXT", ""),
                    units=ptr.get("UNITS", ""),
                    lo_limit=float(ptr.get("LO_LIMIT", 0)) if ptr.get("LO_LIMIT") is not None else None,
                    hi_limit=float(ptr.get("HI_LIMIT", 0)) if ptr.get("HI_LIMIT") is not None else None,
                    count=0,
                )
            test_map[tnum].count += 1

        # 计算每个测试项的失败率
        for tnum, ptr in enumerate(collector.ptr_list):
            test_idx = ptr.get("TEST_NUM", 0)
            if test_idx in test_map:
                lo_limit = ptr.get("LO_LIMIT")
                hi_limit = ptr.get("HI_LIMIT")
                result = float(ptr.get("RESULT", 0))
                is_pass = (lo_limit is None or result >= lo_limit) and (hi_limit is None or result <= hi_limit)
                if not hasattr(test_map[test_idx], '_fail_count'):
                    test_map[test_idx]._fail_count = 0
                    test_map[test_idx]._total_count = 0
                test_map[test_idx]._total_count += 1
                if not is_pass:
                    test_map[test_idx]._fail_count += 1

        # 计算失败率
        for test_info in test_map.values():
            total = getattr(test_info, '_total_count', test_info.count)
            fail_count = getattr(test_info, '_fail_count', 0)
            test_info.fail_rate = round((fail_count / total * 100), 2) if total > 0 else 0

        # 按失败率从高到低排序
        return sorted(test_map.values(), key=lambda t: (-t.fail_rate, t.test_num))

    def get_wafer_map(self, file_path: str) -> WaferMapResponse:
        """获取 Wafer Map 数据"""
        collector = self._get_cached_collector(file_path)
        if not collector:
            collector = self._parse_file(file_path)
            self._set_cache(file_path, collector)

        dies = []
        for prr in collector.prr_list:
            dies.append(
                DieResult(
                    x_coord=prr.get("X_COORD", 0),
                    y_coord=prr.get("Y_COORD", 0),
                    hard_bin=prr.get("HARD_BIN", 0),
                    soft_bin=prr.get("SOFT_BIN", 0),
                    part_flag=prr.get("PART_FLG", 0),
                    site_num=prr.get("SITE_NUM", 0),
                )
            )

        wafer_id = ""
        if collector.wir_list:
            wafer_id = collector.wir_list[0].get("WAFER_ID", "")

        return WaferMapResponse(
            wafer_id=wafer_id,
            total_dies=len(dies),
            dies=dies,
        )
