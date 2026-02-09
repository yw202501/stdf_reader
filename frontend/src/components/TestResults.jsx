import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Space, Empty } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { getTestResults, getTestList } from '../services/api';

const { Option } = Select;

function TestResults({ filename }) {
  const [testList, setTestList] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 5000, total: 0 });

  // 加载测试列表
  useEffect(() => {
    if (!filename) return;
    getTestList(filename).then((res) => {
      setTestList(res.data.tests || []);
    });
  }, [filename]);

  // 加载测试结果
  useEffect(() => {
    if (!filename || selectedTest === null) return;
    setLoading(true);
    getTestResults(filename, {
      test_num: selectedTest,
      page: pagination.current,
      page_size: pagination.pageSize,
    })
      .then((res) => {
        const data = res.data;
        setResults(data.results || []);
        setPagination((prev) => ({ ...prev, total: data.total }));
      })
      .finally(() => setLoading(false));
  }, [filename, selectedTest, pagination.current, pagination.pageSize]);

  // 获取当前测试的 limit 信息
  const currentTestInfo = testList.find((t) => t.test_num === selectedTest);

  const columns = [
    { title: 'Site', dataIndex: 'site_num', width: 80 },
    { title: 'Head', dataIndex: 'head_num', width: 80 },
    {
      title: 'Result',
      dataIndex: 'result',
      render: (val, record) => {
        const pass =
          (record.lo_limit === null || val >= record.lo_limit) &&
          (record.hi_limit === null || val <= record.hi_limit);
        return <span style={{ color: pass ? '#3f8600' : '#cf1322' }}>{val?.toFixed(6)}</span>;
      },
    },
    { title: 'Units', dataIndex: 'units', width: 80 },
    {
      title: 'Lo Limit',
      dataIndex: 'lo_limit',
      render: (val) => val?.toFixed(6) ?? '-',
      width: 120,
    },
    {
      title: 'Hi Limit',
      dataIndex: 'hi_limit',
      render: (val) => val?.toFixed(6) ?? '-',
      width: 120,
    },
    { title: 'Test Text', dataIndex: 'test_txt', ellipsis: true },
  ];

  // 图表数据 - 生成分布直方图
  const generateHistogramData = () => {
    if (results.length === 0) return [];
    
    const values = results.map(r => r.result);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    const bucketCount = Math.min(20, Math.ceil(Math.sqrt(results.length)));
    const bucketWidth = range === 0 ? 1 : range / bucketCount;
    
    const buckets = Array(bucketCount).fill(0);
    const bucketLabels = [];
    
    for (let i = 0; i < bucketCount; i++) {
      const bucketMin = minVal + i * bucketWidth;
      const bucketMax = minVal + (i + 1) * bucketWidth;
      bucketLabels.push(`${bucketMin.toFixed(2)}-${bucketMax.toFixed(2)}`);
    }
    
    values.forEach(val => {
      let bucketIdx = Math.floor((val - minVal) / bucketWidth);
      if (bucketIdx === bucketCount) bucketIdx = bucketCount - 1;
      buckets[bucketIdx]++;
    });
    
    return buckets.map((count, i) => ({
      range: bucketLabels[i],
      count: count,
    }));
  };

  // 计算统计信息
  const calculateStats = () => {
    if (results.length === 0) return null;
    
    const values = results.map(r => r.result).sort((a, b) => a - b);
    const n = values.length;
    
    // 平均数
    const mean = values.reduce((a, b) => a + b, 0) / n;
    
    // 中位数
    const median = n % 2 === 0 
      ? (values[n / 2 - 1] + values[n / 2]) / 2 
      : values[Math.floor(n / 2)];
    
    // 标准差
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    // 最小值和最大值
    const min = values[0];
    const max = values[n - 1];
    
    // 通过和失败数
    const passCount = results.filter(r => {
      const pass = (currentTestInfo?.lo_limit === null || r.result >= currentTestInfo?.lo_limit) &&
                   (currentTestInfo?.hi_limit === null || r.result <= currentTestInfo?.hi_limit);
      return pass;
    }).length;
    const failCount = n - passCount;
    
    return {
      mean,
      median,
      stdDev,
      min,
      max,
      passCount,
      failCount,
      loLimit: currentTestInfo?.lo_limit,
      hiLimit: currentTestInfo?.hi_limit,
    };
  };

  const histogramData = selectedTest !== null ? generateHistogramData() : [];
  const stats = selectedTest !== null ? calculateStats() : null;

  return (
    <div>
      {/* 测试项选择 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>选择测试项：</span>
          <Select
            showSearch
            style={{ width: 500 }}
            placeholder="搜索或选择测试项"
            value={selectedTest}
            onChange={(val) => {
              setSelectedTest(val);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            }
          >
            {testList.map((t) => (
              <Option key={t.test_num} value={t.test_num}>
                {`#${t.test_num} - ${t.test_txt} (${t.count} results, ${t.fail_rate || 0}% fail rate)`}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      {selectedTest !== null && (
        <>
          {/* 统计信息卡片 */}
          {stats && (
            <Card style={{ marginBottom: 16, background: '#fafafa' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>平均值</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats.mean.toFixed(6)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>中位数</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats.median.toFixed(6)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>标准差</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats.stdDev.toFixed(6)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>范围</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats.min.toFixed(6)} ~ {stats.max.toFixed(6)}</div>
                </div>
                {stats.loLimit !== null && (
                  <div>
                    <div style={{ fontSize: 12, color: '#999' }}>下限 (Lo)</div>
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cf1322' }}>{stats.loLimit.toFixed(6)}</div>
                  </div>
                )}
                {stats.hiLimit !== null && (
                  <div>
                    <div style={{ fontSize: 12, color: '#999' }}>上限 (Hi)</div>
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cf1322' }}>{stats.hiLimit.toFixed(6)}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>通过</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: '#3f8600' }}>{stats.passCount}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#999' }}>失败</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: '#cf1322' }}>{stats.failCount}</div>
                </div>
              </div>
            </Card>
          )}

          {/* 测试结果分布直方图 */}
          {histogramData.length > 0 && (
            <Card title="测试结果分布" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#1890ff" name="频数" />
                  {stats?.hiLimit != null && (
                    <ReferenceLine x={stats.hiLimit} stroke="#cf1322" label={{ value: `Hi: ${stats.hiLimit.toFixed(2)}`, position: 'top' }} strokeDasharray="5 5" />
                  )}
                  {stats?.loLimit != null && (
                    <ReferenceLine x={stats.loLimit} stroke="#cf1322" label={{ value: `Lo: ${stats.loLimit.toFixed(2)}`, position: 'top' }} strokeDasharray="5 5" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* 测试结果表格 */}
          <Card title="测试结果数据">
            <Table
              columns={columns}
              dataSource={results}
              rowKey={(_, idx) => idx}
              loading={loading}
              size="small"
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                pageSizeOptions: ['100', '500', '1000', '5000'],
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) =>
                  setPagination({ current: page, pageSize, total: pagination.total }),
              }}
            />
          </Card>
        </>
      )}

      {selectedTest === null && <Empty description="请选择一个测试项查看结果" />}
    </div>
  );
}

export default TestResults;
