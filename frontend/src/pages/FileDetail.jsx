import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Spin, Button, message, Progress, Alert, Space, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getFileSummary, getWaferMap, startParse, getParseProgress } from '../services/api';
import TestSummary from '../components/TestSummary';
import TestResults from '../components/TestResults';
import WaferMap from '../components/WaferMap';

const normalizeProgram = (mir = {}) => ({
  job_name: (mir.job_name || '').trim(),
  exec_type: (mir.exec_type || '').trim(),
  exec_ver: (mir.exec_ver || '').trim(),
  tester_type: (mir.tester_type || '').trim(),
});

const buildProgramKey = (mir = {}) => {
  const p = normalizeProgram(mir);
  return `${p.job_name}|${p.exec_type}|${p.exec_ver}|${p.tester_type}`;
};

const mergeSummaries = (summaryItems) => {
  if (!summaryItems || summaryItems.length === 0) {
    return null;
  }

  const totalParts = summaryItems.reduce((sum, item) => sum + (item.total_parts || 0), 0);
  const passCount = summaryItems.reduce((sum, item) => sum + (item.pass_count || 0), 0);
  const failCount = summaryItems.reduce((sum, item) => sum + (item.fail_count || 0), 0);
  const yieldRate = totalParts > 0 ? Number(((passCount / totalParts) * 100).toFixed(2)) : 0;

  const siteMap = new Map();
  const hbinMap = new Map();
  const failedTestsByBin = new Map();
  const siteSet = new Set();
  let totalTests = 0;

  summaryItems.forEach((item) => {
    totalTests = Math.max(totalTests, item.total_tests || 0);
    (item.sites || []).forEach((site) => siteSet.add(site));

    (item.site_yields || []).forEach((siteYield) => {
      const key = siteYield.site_num;
      const existing = siteMap.get(key) || { total_parts: 0, pass_count: 0, fail_count: 0 };
      existing.total_parts += siteYield.total_parts || 0;
      existing.pass_count += siteYield.pass_count || 0;
      existing.fail_count += siteYield.fail_count || 0;
      siteMap.set(key, existing);
    });

    Object.entries(item.hbin_counts || {}).forEach(([bin, count]) => {
      const current = hbinMap.get(bin) || 0;
      hbinMap.set(bin, current + (count || 0));
    });

    (item.hbin_details || []).forEach((binInfo) => {
      const key = String(binInfo.bin_num);
      if (!failedTestsByBin.has(key)) {
        failedTestsByBin.set(key, new Set());
      }
      (binInfo.failed_tests || []).forEach((test) => failedTestsByBin.get(key).add(test));
    });
  });

  const siteYields = [...siteMap.entries()]
    .map(([site_num, value]) => ({
      site_num: Number(site_num),
      total_parts: value.total_parts,
      pass_count: value.pass_count,
      fail_count: value.fail_count,
      yield_rate: value.total_parts > 0 ? Number(((value.pass_count / value.total_parts) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.site_num - b.site_num);

  const hbinCounts = {};
  [...hbinMap.entries()].forEach(([bin, count]) => {
    hbinCounts[bin] = count;
  });

  const hbinDetails = [...hbinMap.entries()]
    .map(([bin, count]) => ({
      bin_num: Number(bin),
      count,
      percent: totalParts > 0 ? Number(((count / totalParts) * 100).toFixed(2)) : 0,
      failed_tests: [...(failedTestsByBin.get(bin) || new Set())].slice(0, 10),
    }))
    .sort((a, b) => a.bin_num - b.bin_num);

  return {
    ...summaryItems[0],
    total_parts: totalParts,
    pass_count: passCount,
    fail_count: failCount,
    yield_rate: yieldRate,
    sites: [...siteSet].sort((a, b) => a - b),
    site_yields: siteYields,
    hbin_counts: hbinCounts,
    hbin_details: hbinDetails,
    total_tests: totalTests,
  };
};

function FileDetail() {
  const { filename } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [summaries, setSummaries] = useState([]);
  const [waferDataList, setWaferDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [parsePercent, setParsePercent] = useState(0);
  const [parseStatus, setParseStatus] = useState('idle');
  const [currentParsingFile, setCurrentParsingFile] = useState('');

  const filenames = useMemo(() => {
    const fromState = location.state?.filenames;
    if (Array.isArray(fromState) && fromState.length > 0) {
      return [...new Set(fromState)];
    }
    return filename ? [filename] : [];
  }, [filename, location.state]);

  useEffect(() => {
    if (!filenames.length) return;

    let stopped = false;

    const waitForParseDone = async (jobId, fileIndex, fileCount) => {
      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const progressRes = await getParseProgress(jobId);
            if (stopped) {
              resolve();
              return;
            }

            const { status, percent, error } = progressRes.data;
            const overall = ((fileIndex + (percent || 0) / 100) / fileCount) * 100;
            setParsePercent(Math.round(overall));

            if (status === 'done') {
              resolve();
              return;
            }
            if (status === 'error') {
              reject(new Error(error || '未知解析错误'));
              return;
            }
            setTimeout(poll, 500);
          } catch (err) {
            reject(err);
          }
        };
        poll();
      });
    };

    const startAndWaitParse = async (targetFile, fileIndex, fileCount) => {
      const startRes = await startParse(targetFile);
      const jobId = startRes.data.job_id;
      await waitForParseDone(jobId, fileIndex, fileCount);
    };

    const loadData = async () => {
      const allData = await Promise.all(
        filenames.map(async (f) => {
          const [summaryRes, waferRes] = await Promise.all([getFileSummary(f), getWaferMap(f)]);
          return {
            filename: f,
            summary: summaryRes.data,
            wafer: waferRes.data,
          };
        })
      );

      if (!stopped) {
        setSummaries(allData.map((item) => ({ filename: item.filename, data: item.summary })));
        setWaferDataList(allData.map((item) => ({ filename: item.filename, data: item.wafer })));
      }
    };

    const run = async () => {
      setLoading(true);
      setParseStatus('running');
      setParsePercent(0);

      try {
        for (let i = 0; i < filenames.length; i += 1) {
          if (stopped) return;
          setCurrentParsingFile(filenames[i]);
          await startAndWaitParse(filenames[i], i, filenames.length);
        }

        if (!stopped) {
          setParseStatus('done');
          setParsePercent(100);
          setCurrentParsingFile('');
        }

        await loadData();
      } catch (err) {
        if (!stopped) {
          setParseStatus('error');
          message.error(`解析或加载失败: ${err.message}`);
        }
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      stopped = true;
    };
  }, [filenames]);

  const summaryItems = summaries.map((item) => item.data);
  const mergedSummary = useMemo(() => mergeSummaries(summaryItems), [summaryItems]);

  const programKeys = useMemo(() => {
    const keys = new Set();
    summaryItems.forEach((item) => keys.add(buildProgramKey(item?.mir)));
    return [...keys];
  }, [summaryItems]);

  const canMergeTests = programKeys.length <= 1;
  const showProgramWarning = filenames.length > 1 && !canMergeTests;

  const tabItems = [
    {
      key: 'summary',
      label: '摘要信息',
      children: (
        <div>
          {filenames.length > 1 && (
            <div className="file-detail-chip-wrap">
              <Space wrap>
                <span className="file-detail-chip-label">当前选择文件:</span>
                {filenames.map((f) => (
                  <Tag key={f} color="blue">
                    {f}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
          {showProgramWarning && (
            <Alert
              type="warning"
              showIcon
              message="检测到选中文件不是同一个程序，测试项结果不会合并。"
              style={{ marginBottom: 16 }}
            />
          )}
          <TestSummary summary={mergedSummary} />
        </div>
      ),
    },
    {
      key: 'results',
      label: '测试结果',
      children: <TestResults filenames={filenames} canMergeTests={canMergeTests} programWarning={showProgramWarning} />,
    },
    {
      key: 'wafermap',
      label: 'Wafer Map',
      children: (
        <div>
          {waferDataList.map((item) => (
            <div key={item.filename} className="file-detail-wafer-item">
              {filenames.length > 1 && <div className="file-detail-file-label">文件: {item.filename}</div>}
              <WaferMap waferData={item.data} />
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="file-detail-page">
      <Button icon={<ArrowLeftOutlined />} className="file-detail-back-btn" onClick={() => navigate('/')}>
        返回文件列表
      </Button>

      {parseStatus === 'running' ? (
        <div className="apple-glass-panel file-detail-progress">
          <div className="file-detail-progress-text">正在解析文件...{currentParsingFile ? ` (${currentParsingFile})` : ''}</div>
          <Progress percent={parsePercent} status="active" />
        </div>
      ) : null}

      <Spin spinning={loading}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" className="file-detail-tabs apple-glass-panel" />
      </Spin>
    </div>
  );
}

export default FileDetail;
