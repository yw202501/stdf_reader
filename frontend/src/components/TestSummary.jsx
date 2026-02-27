import React from 'react';
import { Card, Descriptions, Row, Col, Statistic, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

function TestSummary({ summary }) {
  if (!summary) return null;

  const { mir, total_parts, pass_count, fail_count, yield_rate, site_yields, hbin_counts, hbin_details, total_tests } = summary;

  const formatBinPercent = (count) => {
    if (!total_parts) return '0.00%';
    return `${((count / total_parts) * 100).toFixed(2)}%`;
  };

  const hbinPieEntries = hbin_counts ? Object.entries(hbin_counts).filter(([bin]) => Number(bin) !== 1) : [];
  const pieColors = ['#ff4d4f', '#faad14', '#1890ff', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'];

  return (
    <div className="summary-view">
      <Row gutter={16} className="summary-top-row">
        <Col span={6}>
          <Card className="apple-glass-panel summary-mini-card">
            <Statistic title="总芯片数" value={total_parts} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="apple-glass-panel summary-mini-card">
            <Statistic title="通过数量" value={pass_count} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="apple-glass-panel summary-mini-card">
            <Statistic title="失败数量" value={fail_count} valueStyle={{ color: '#cf1322' }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="apple-glass-panel summary-mini-card">
            <Statistic
              title="良率"
              value={yield_rate}
              suffix="%"
              precision={2}
              valueStyle={{ color: yield_rate >= 90 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {site_yields && site_yields.length > 0 && (
        <Card className="apple-glass-panel summary-section-card">
          <Row gutter={16}>
            {site_yields.map((siteYield) => (
              <Col span={6} key={siteYield.site_num}>
                <Space direction="vertical" size={0} className="site-yield-item">
                  <span className="site-yield-title">Site {siteYield.site_num}</span>
                  <span>总数: {siteYield.total_parts}</span>
                  <span className="site-yield-pass">通过: {siteYield.pass_count}</span>
                  <span className="site-yield-fail">失败: {siteYield.fail_count}</span>
                  <span className={`site-yield-rate ${siteYield.yield_rate >= 90 ? 'is-good' : 'is-bad'}`}>
                    良率: {siteYield.yield_rate}%
                  </span>
                </Space>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {mir && (
        <Card className="apple-glass-panel summary-section-card" title="测试信息 (MIR)">
          <Descriptions column={3} size="small">
            <Descriptions.Item label="Lot ID">{mir.lot_id}</Descriptions.Item>
            <Descriptions.Item label="Part Type">{mir.part_type}</Descriptions.Item>
            <Descriptions.Item label="Job Name">{mir.job_name}</Descriptions.Item>
            <Descriptions.Item label="Tester Type">{mir.tester_type}</Descriptions.Item>
            <Descriptions.Item label="Node Name">{mir.node_name}</Descriptions.Item>
            <Descriptions.Item label="Station">{mir.station_number}</Descriptions.Item>
            <Descriptions.Item label="Facility">{mir.facility_id}</Descriptions.Item>
            <Descriptions.Item label="Floor">{mir.floor_id}</Descriptions.Item>
            <Descriptions.Item label="Process">{mir.process_id}</Descriptions.Item>
            <Descriptions.Item label="Start Time">{mir.start_time}</Descriptions.Item>
            <Descriptions.Item label="Exec Type">{mir.exec_type}</Descriptions.Item>
            <Descriptions.Item label="Exec Ver">{mir.exec_ver}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card className="apple-glass-panel summary-section-card" title={`统计信息 - 测试项总数: ${total_tests}`}>
        <div className="summary-bin-layout">
          {hbin_counts && Object.keys(hbin_counts).length > 0 ? (
            <>
              <div className="summary-bin-chart-wrap">
                <h4 className="summary-panel-title">Hard Bin 分布</h4>
                {hbinPieEntries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={hbinPieEntries.map(([bin, count]) => ({
                          name: `Bin ${bin}`,
                          value: count,
                          bin,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value} (${formatBinPercent(entry.value)})`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {hbinPieEntries.map(([bin], index) => (
                          <Cell key={`cell-${bin}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, _name, props) => [`${value} (${formatBinPercent(value)})`, props.payload.name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="summary-empty-tip">仅有 Bin 1（通过）数据，已隐藏</div>
                )}
              </div>

              <div className="summary-bin-list-wrap">
                <h4 className="summary-panel-title summary-panel-title-left">各Bin失败测试项</h4>
                {hbin_details && hbin_details.length > 0 ? (
                  <div className="summary-bin-list">
                    {hbin_details.map((binInfo) => (
                      <div key={binInfo.bin_num} className="summary-bin-item">
                        <div className={`summary-bin-item-title ${binInfo.bin_num === 1 ? 'is-pass' : 'is-fail'}`}>
                          Bin {binInfo.bin_num}: {binInfo.count} ({binInfo.percent}%)
                        </div>
                        {binInfo.failed_tests && binInfo.failed_tests.length > 0 ? (
                          <div className="summary-failed-tests">
                            {binInfo.failed_tests.map((test, idx) => (
                              <div key={idx} className="summary-failed-test-line">
                                • {test}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="summary-no-failed-tests">{binInfo.bin_num === 1 ? '通过' : '无失败测试项数据'}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="summary-empty-tip summary-empty-tip-left">暂无详细信息</div>
                )}
              </div>
            </>
          ) : (
            <div className="summary-empty-tip summary-empty-tip-full">暂无 Hard Bin 数据</div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default TestSummary;
