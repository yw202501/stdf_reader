import React from 'react';
import { Card, Descriptions, Row, Col, Statistic, Tag, Space } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

function TestSummary({ summary }) {
  if (!summary) return null;

  const { mir, mrr, total_parts, pass_count, fail_count, yield_rate, sites, site_yields, hbin_counts, hbin_details, total_tests } = summary;

  const formatBinPercent = (count) => {
    if (!total_parts) {
      return '0.00%';
    }
    return `${((count / total_parts) * 100).toFixed(2)}%`;
  };
  const hbinPieEntries = hbin_counts
    ? Object.entries(hbin_counts).filter(([bin]) => Number(bin) !== 1)
    : [];
  const pieColors = ['#ff4d4f', '#faad14', '#1890ff', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总芯片数" value={total_parts} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通过数量"
              value={pass_count}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败数量"
              value={fail_count}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
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

      {/* Site 良率统计 */}
      {site_yields && site_yields.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {site_yields.map((siteYield) => (
              <Col span={6} key={siteYield.site_num}>
                <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 'bold' }}>Site {siteYield.site_num}</span>
                  <span>总数: {siteYield.total_parts}</span>
                  <span style={{ color: '#3f8600' }}>通过: {siteYield.pass_count}</span>
                  <span style={{ color: '#cf1322' }}>失败: {siteYield.fail_count}</span>
                  <span style={{ color: siteYield.yield_rate >= 90 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
                    良率: {siteYield.yield_rate}%
                  </span>
                </Space>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* MIR 信息 */}
      {mir && (
        <Card title="测试信息 (MIR)" style={{ marginBottom: 16 }}>
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

      {/* 额外信息 */}
      <Card title={`统计信息 - 测试项总数: ${total_tests}`} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* 左侧：饼图 */}
          {hbin_counts && Object.keys(hbin_counts).length > 0 ? (
            <>
              <div style={{ flex: '0 0 500px' }}>
                <h4 style={{ marginBottom: 16, textAlign: 'center' }}>Hard Bin 分布</h4>
                {hbinPieEntries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={hbinPieEntries.map(([bin, count]) => ({
                          name: `Bin ${bin}`,
                          value: count,
                          bin: bin,
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
                          <Cell
                            key={`cell-${bin}`}
                            fill={pieColors[index % pieColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${value} (${formatBinPercent(value)})`,
                          props.payload.name,
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                    仅有 Bin 1（通过）数据，已隐藏
                  </div>
                )}
              </div>
              
              {/* 右侧：测试项列表 */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                <h4 style={{ marginBottom: 16, marginTop: 0 }}>各Bin失败测试项</h4>
                {hbin_details && hbin_details.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {hbin_details.map((binInfo) => (
                      <div 
                        key={binInfo.bin_num} 
                        style={{ 
                          padding: '12px', 
                          border: '1px solid rgba(0, 212, 255, 0.2)', 
                          borderRadius: '4px',
                          background: 'rgba(26, 58, 82, 0.3)'
                        }}
                      >
                        <div style={{ 
                          fontWeight: 'bold', 
                          marginBottom: '8px',
                          color: binInfo.bin_num === 1 ? '#52c41a' : '#ff4d4f'
                        }}>
                          Bin {binInfo.bin_num}: {binInfo.count} ({binInfo.percent}%)
                        </div>
                        {binInfo.failed_tests && binInfo.failed_tests.length > 0 ? (
                          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                            {binInfo.failed_tests.map((test, idx) => (
                              <div key={idx} style={{ 
                                padding: '4px 8px', 
                                background: 'rgba(0, 0, 0, 0.2)', 
                                marginBottom: '4px',
                                borderRadius: '2px'
                              }}>
                                • {test}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                            {binInfo.bin_num === 1 ? '通过' : '无失败测试项数据'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#999', fontStyle: 'italic' }}>暂无详细信息</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999', width: '100%' }}>
              暂无 Hard Bin 数据
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default TestSummary;
