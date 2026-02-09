import React, { useMemo } from 'react';
import { Card, Tag, Empty } from 'antd';

/**
 * Wafer Map 可视化组件
 * 用颜色表示每个 Die 的 Hard Bin 结果
 */
function WaferMap({ waferData }) {
  if (!waferData || !waferData.dies || waferData.dies.length === 0) {
    return (
      <Card title="Wafer Map">
        <Empty description="无 Wafer Map 数据" />
      </Card>
    );
  }

  const { dies, wafer_id, total_dies } = waferData;

  // 计算坐标范围
  const { minX, maxX, minY, maxY, cellSize, binColors } = useMemo(() => {
    const xs = dies.map((d) => d.x_coord);
    const ys = dies.map((d) => d.y_coord);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const maxDim = Math.max(cols, rows);
    const cellSize = Math.min(Math.max(4, Math.floor(500 / maxDim)), 20);

    // Bin 颜色映射
    const bins = [...new Set(dies.map((d) => d.hard_bin))].sort();
    const palette = ['#52c41a', '#f5222d', '#faad14', '#1890ff', '#722ed1', '#eb2f96', '#fa8c16', '#13c2c2'];
    const binColors = {};
    bins.forEach((b, i) => {
      binColors[b] = b === 1 ? '#52c41a' : palette[(i % (palette.length - 1)) + 1];
    });

    return { minX, maxX, minY, maxY, cellSize, binColors };
  }, [dies]);

  const width = (maxX - minX + 1) * cellSize + 2;
  const height = (maxY - minY + 1) * cellSize + 2;

  return (
    <Card
      title={`Wafer Map${wafer_id ? ` - ${wafer_id}` : ''}`}
      extra={<span>Total Dies: {total_dies}</span>}
    >
      {/* 图例 */}
      <div style={{ marginBottom: 12 }}>
        {Object.entries(binColors).map(([bin, color]) => (
          <Tag key={bin} color={color}>
            Bin {bin}
          </Tag>
        ))}
      </div>

      {/* Wafer Map SVG */}
      <div className="wafer-map-container" style={{ overflow: 'auto' }}>
        <svg width={width} height={height} style={{ border: '1px solid #d9d9d9', borderRadius: 4 }}>
          {dies.map((die, i) => (
            <rect
              key={i}
              x={(die.x_coord - minX) * cellSize + 1}
              y={(die.y_coord - minY) * cellSize + 1}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={binColors[die.hard_bin] || '#ccc'}
              stroke="#fff"
              strokeWidth={0.5}
            >
              <title>
                {`X: ${die.x_coord}, Y: ${die.y_coord}\nHBin: ${die.hard_bin}, SBin: ${die.soft_bin}\nSite: ${die.site_num}`}
              </title>
            </rect>
          ))}
        </svg>
      </div>
    </Card>
  );
}

export default WaferMap;
