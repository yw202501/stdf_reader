import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Select, Space, Empty, Alert, message, Button, Spin } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer, Brush,
} from 'recharts';
import { getTestResults, getTestList } from '../services/api';

const { Option } = Select;

const MERGE_FETCH_LIMIT = 5000;
const MAX_SELECTED = 8;

const mergeTestLists = (lists) => {
  const merged = new Map();
  lists.forEach((testList) => {
    (testList || []).forEach((test) => {
      const existing = merged.get(test.test_num) || { ...test, count: 0, _failWeightedCount: 0 };
      existing.count += test.count || 0;
      existing._failWeightedCount += (test.fail_rate || 0) * (test.count || 0);
      if (!existing.test_txt && test.test_txt) existing.test_txt = test.test_txt;
      if (!existing.units && test.units) existing.units = test.units;
      if (existing.lo_limit == null && test.lo_limit != null) existing.lo_limit = test.lo_limit;
      if (existing.hi_limit == null && test.hi_limit != null) existing.hi_limit = test.hi_limit;
      merged.set(test.test_num, existing);
    });
  });
  return [...merged.values()]
    .map((test) => ({
      ...test,
      fail_rate: test.count > 0 ? Number((test._failWeightedCount / test.count).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.test_num - b.test_num);
};

function TestResults({ filenames = [], canMergeTests = true, programWarning = false }) {
  const [testList, setTestList] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedFile, setSelectedFile] = useState(filenames[0] || null);
  const [resultsMap, setResultsMap] = useState({});

  useEffect(() => {
    setSelectedFile(filenames[0] || null);
  }, [filenames]);

  const activeFilenames = useMemo(() => {
    if (canMergeTests) return filenames;
    return selectedFile ? [selectedFile] : [];
  }, [canMergeTests, filenames, selectedFile]);

  useEffect(() => {
    if (!activeFilenames.length) return;
    const load = async () => {
      try {
        if (canMergeTests) {
          const listRes = await Promise.all(activeFilenames.map((f) => getTestList(f)));
          setTestList(mergeTestLists(listRes.map((res) => res.data.tests || [])));
        } else {
          const res = await getTestList(activeFilenames[0]);
          setTestList(res.data.tests || []);
        }
      } catch (err) {
        message.error(`加载测试项失败: ${err.message}`);
        setTestList([]);
      } finally {
        setSelectedTests([]);
        setResultsMap({});
      }
    };
    load();
  }, [activeFilenames, canMergeTests]);

  const loadResultsForTest = useCallback(
    async (testNum) => {
      setResultsMap((prev) => ({ ...prev, [testNum]: { results: [], loading: true } }));
      try {
        let results = [];
        if (canMergeTests) {
          const fetchFile = async (file) => {
            const first = await getTestResults(file, { test_num: testNum, page: 1, page_size: MERGE_FETCH_LIMIT });
            const total = first.data.total || 0;
            const all = [...(first.data.results || [])];
            const pages = Math.max(1, Math.ceil(total / MERGE_FETCH_LIMIT));
            for (let p = 2; p <= pages; p += 1) {
              const res = await getTestResults(file, { test_num: testNum, page: p, page_size: MERGE_FETCH_LIMIT });
              all.push(...(res.data.results || []));
            }
            return all.map((r, idx) => ({ ...r, file_name: file, _row_key: `${file}-${idx}` }));
          };
          const all = await Promise.all(activeFilenames.map(fetchFile));
          results = all.flat();
        } else {
          const file = activeFilenames[0];
          if (file) {
            const res = await getTestResults(file, { test_num: testNum, page: 1, page_size: MERGE_FETCH_LIMIT });
            results = (res.data.results || []).map((r, idx) => ({ ...r, _row_key: `${file}-${idx}` }));
          }
        }
        setResultsMap((prev) => ({ ...prev, [testNum]: { results, loading: false } }));
      } catch (err) {
        message.error(`加载测试 #${testNum} 失败: ${err.message}`);
        setResultsMap((prev) => ({ ...prev, [testNum]: { results: [], loading: false } }));
      }
    },
    [activeFilenames, canMergeTests],
  );

  useEffect(() => {
    const selectedSet = new Set(selectedTests);
    selectedTests.forEach((testNum) => {
      if (!(testNum in resultsMap)) {
        loadResultsForTest(testNum);
      }
    });
    const toRemove = Object.keys(resultsMap).map(Number).filter((k) => !selectedSet.has(k));
    if (toRemove.length > 0) {
      setResultsMap((prev) => {
        const next = { ...prev };
        toRemove.forEach((k) => delete next[k]);
        return next;
      });
    }
  }, [selectedTests]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateHistogramData = (results) => {
    if (!results || results.length === 0) return [];
    const values = results.map((r) => r.result).filter((v) => v != null);
    if (values.length === 0) return [];
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    const bucketCount = Math.min(30, Math.ceil(Math.sqrt(values.length)));
    const bucketWidth = range === 0 ? 1 : range / bucketCount;
    const buckets = Array(bucketCount).fill(0);
    const bucketLabels = [];
    for (let i = 0; i < bucketCount; i += 1) {
      const bMin = minVal + i * bucketWidth;
      bucketLabels.push(`${bMin.toFixed(4)}`);
    }
    values.forEach((val) => {
      let idx = Math.floor((val - minVal) / bucketWidth);
      if (idx === bucketCount) idx = bucketCount - 1;
      buckets[idx] += 1;
    });
    return buckets.map((count, i) => ({ range: bucketLabels[i], count }));
  };

  const calculateStats = (results, testInfo) => {
    if (!results || results.length === 0) return null;
    const values = results.map((r) => r.result).filter((v) => v != null).sort((a, b) => a - b);
    const n = values.length;
    if (n === 0) return null;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 ? (values[n / 2 - 1] + values[n / 2]) / 2 : values[Math.floor(n / 2)];
    const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const loLimit = testInfo?.lo_limit ?? null;
    const hiLimit = testInfo?.hi_limit ?? null;
    const passCount = results.filter(
      (r) => (loLimit === null || r.result >= loLimit) && (hiLimit === null || r.result <= hiLimit),
    ).length;
    return { mean, median, stdDev, min: values[0], max: values[n - 1], passCount, failCount: n - passCount, loLimit, hiLimit };
  };

  const exportCSV = () => {
    const headers = ['test_num', 'test_txt', 'site_num', 'head_num', 'result', 'units', 'lo_limit', 'hi_limit'];
    if (canMergeTests && filenames.length > 1) headers.unshift('file_name');
    const rows = [];
    selectedTests.forEach((testNum) => {
      const testInfo = testList.find((t) => t.test_num === testNum);
      const { results = [] } = resultsMap[testNum] || {};
      results.forEach((r) => {
        rows.push(
          headers.map((h) => {
            if (h === 'test_num') return testNum;
            if (h === 'test_txt') return testInfo?.test_txt || '';
            return r[h] ?? '';
          }).join(','),
        );
      });
    });
    if (!rows.length) {
      message.warning('暂无数据可导出');
      return;
    }
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="results-view">
      {programWarning && <Alert type="warning" showIcon message="选中文件的程序不一致，测试项不会跨文件合并。" className="results-warning" />}

      <Card className="apple-glass-panel results-toolbar-card">
        <Space wrap className="results-toolbar-space">
          {!canMergeTests && filenames.length > 1 && (
            <>
              <span>选择文件：</span>
              <Select className="results-file-select" value={selectedFile} onChange={setSelectedFile}>
                {filenames.map((f) => <Option key={f} value={f}>{f}</Option>)}
              </Select>
            </>
          )}
          <span>选择测试项：</span>
          <Select
            mode="multiple"
            showSearch
            className="results-test-select"
            placeholder={`搜索或选择测试项（最多 ${MAX_SELECTED} 个）`}
            value={selectedTests}
            onChange={(vals) => {
              if (vals.length > MAX_SELECTED) {
                message.warning(`最多同时选择 ${MAX_SELECTED} 个测试项`);
                return;
              }
              setSelectedTests(vals);
            }}
            maxTagCount="responsive"
            filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
          >
            {testList.map((t) => (
              <Option key={t.test_num} value={t.test_num}>
                {`#${t.test_num} - ${t.test_txt} (${t.count} 条, 失败率 ${t.fail_rate || 0}%)`}
              </Option>
            ))}
          </Select>
          {selectedTests.length > 0 && (
            <Button type="primary" className="apple-primary-btn" onClick={exportCSV}>
              导出 CSV
            </Button>
          )}
        </Space>
      </Card>

      {selectedTests.length === 0 && <Empty description="请选择测试项查看结果" />}

      {selectedTests.map((testNum) => {
        const testInfo = testList.find((t) => t.test_num === testNum);
        const { results = [], loading: testLoading } = resultsMap[testNum] || { loading: true };
        const histData = generateHistogramData(results);
        const stats = calculateStats(results, testInfo);

        return (
          <Card className="apple-glass-panel results-test-card" key={testNum} title={`#${testNum} - ${testInfo?.test_txt || ''}`}>
            {testLoading ? (
              <div className="results-loading-wrap">
                <Spin tip="加载中..." />
              </div>
            ) : (
              <>
                {stats && (
                  <div className="results-stats-grid">
                    <div>
                      <div className="results-stats-label">平均值</div>
                      <div className="results-stats-value">{stats.mean.toFixed(6)}</div>
                    </div>
                    <div>
                      <div className="results-stats-label">中位数</div>
                      <div className="results-stats-value">{stats.median.toFixed(6)}</div>
                    </div>
                    <div>
                      <div className="results-stats-label">标准差</div>
                      <div className="results-stats-value">{stats.stdDev.toFixed(6)}</div>
                    </div>
                    <div>
                      <div className="results-stats-label">范围</div>
                      <div className="results-stats-value">
                        {stats.min.toFixed(6)} ~ {stats.max.toFixed(6)}
                      </div>
                    </div>
                    {stats.loLimit !== null && (
                      <div>
                        <div className="results-stats-label">下限 (Lo)</div>
                        <div className="results-stats-value is-fail">{stats.loLimit.toFixed(6)}</div>
                      </div>
                    )}
                    {stats.hiLimit !== null && (
                      <div>
                        <div className="results-stats-label">上限 (Hi)</div>
                        <div className="results-stats-value is-fail">{stats.hiLimit.toFixed(6)}</div>
                      </div>
                    )}
                    <div>
                      <div className="results-stats-label">通过</div>
                      <div className="results-stats-value is-pass">{stats.passCount}</div>
                    </div>
                    <div>
                      <div className="results-stats-label">失败</div>
                      <div className="results-stats-value is-fail">{stats.failCount}</div>
                    </div>
                  </div>
                )}

                {histData.length > 0 && (
                  <>
                    <div className="results-chart-tip">拖动下方滑块可缩放图表范围</div>
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={histData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} interval="preserveStartEnd" />
                        <YAxis />
                        <Tooltip formatter={(val) => [val, '频数']} labelFormatter={(label) => `值: ${label}`} />
                        <Legend verticalAlign="top" />
                        <Brush dataKey="range" height={25} stroke="#1890ff" travellerWidth={8} />
                        <Bar dataKey="count" fill="#1890ff" name="频数" isAnimationActive={false} />
                        {stats?.hiLimit != null && (
                          <ReferenceLine
                            x={stats.hiLimit.toFixed(4)}
                            stroke="#cf1322"
                            label={{ value: `Hi: ${stats.hiLimit.toFixed(4)}`, position: 'top', fontSize: 11 }}
                            strokeDasharray="5 5"
                          />
                        )}
                        {stats?.loLimit != null && (
                          <ReferenceLine
                            x={stats.loLimit.toFixed(4)}
                            stroke="#cf1322"
                            label={{ value: `Lo: ${stats.loLimit.toFixed(4)}`, position: 'top', fontSize: 11 }}
                            strokeDasharray="5 5"
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}

                {histData.length === 0 && <Empty description="暂无数据" />}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default TestResults;
