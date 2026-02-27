import React, { useId, useMemo } from 'react';
import { Card, Empty } from 'antd';

/**
 * Wafer Map 可视化组件
 * 采用类 Apple 风格卡片 + 圆形 Wafer 呈现
 */
function WaferMap({ waferData }) {
  if (!waferData || !waferData.dies || waferData.dies.length === 0) {
    return (
      <Card title="Wafer Map">
        <Empty description="无 Wafer Map 数据" />
      </Card>
    );
  }

  const { dies, wafer_id = '', total_dies = 0 } = waferData;
  const clipId = useId().replace(/:/g, '_');

  const mapData = useMemo(() => {
    const xs = dies.map((d) => d.x_coord);
    const ys = dies.map((d) => d.y_coord);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const maxDim = Math.max(cols, rows);
    const cellSize = Math.min(Math.max(5, Math.floor(420 / maxDim)), 14);
    const framePadding = 20;

    const bins = [...new Set(dies.map((d) => d.hard_bin))].sort((a, b) => a - b);
    const binCounts = {};
    dies.forEach((d) => {
      binCounts[d.hard_bin] = (binCounts[d.hard_bin] || 0) + 1;
    });

    const palette = ['#ff5d67', '#ff7a45', '#f7b955', '#9c82ff', '#5cb3ff', '#33d0b2', '#ff8db2'];
    const binColors = {};
    bins.forEach((b, i) => {
      if (b === 1) {
        binColors[b] = '#4de38e';
      } else {
        binColors[b] = palette[i % palette.length];
      }
    });

    const mapWidth = cols * cellSize;
    const mapHeight = rows * cellSize;
    const viewWidth = mapWidth + framePadding * 2;
    const viewHeight = mapHeight + framePadding * 2;
    const cx = viewWidth / 2;
    const cy = viewHeight / 2;
    const radius = Math.min(mapWidth, mapHeight) / 2 + cellSize * 0.35;

    const passDies = binCounts[1] || 0;
    const failedDies = total_dies - passDies;
    const edgeDies = dies.filter((d) =>
      d.x_coord === minX || d.x_coord === maxX || d.y_coord === minY || d.y_coord === maxY
    ).length;

    const otherBins = Object.entries(binCounts)
      .filter(([bin]) => Number(bin) !== 1)
      .sort((a, b) => b[1] - a[1]);

    const topFailBins = otherBins.slice(0, 5).map(([bin, count]) => ({
      bin: Number(bin),
      count,
      color: binColors[Number(bin)],
    }));

    const otherBinTotal = otherBins.slice(5).reduce((sum, [, count]) => sum + count, 0);
    const yieldRate = total_dies > 0 ? ((passDies / total_dies) * 100).toFixed(2) : '0.00';

    return {
      minX,
      minY,
      cellSize,
      binCounts,
      binColors,
      passDies,
      failedDies,
      edgeDies,
      topFailBins,
      otherBinTotal,
      yieldRate,
      viewWidth,
      viewHeight,
      framePadding,
      cx,
      cy,
      radius,
    };
  }, [dies, total_dies]);

  const knownBinLabel = (bin) => {
    const labelMap = {
      1: 'Pass / Good Die',
      2: 'Fail (Open)',
      3: 'Fail (Short)',
      4: 'Fail (Functional)',
      6: 'Fail (Parametric)',
      8: 'Edge / Ndef',
    };
    return labelMap[bin] || 'Fail (Other)';
  };

  return (
    <Card className="wafer-apple-card" bordered={false}>
      <div className="wafer-apple-header">
        <span className="wafer-apple-title">Wafer Map Visualization</span>
        <div className="wafer-apple-pill-row">
          <span className="wafer-pill">WAFER ID {wafer_id || 'N/A'}</span>
          <span className="wafer-pill">TOT DIE {total_dies}</span>
          <span className="wafer-pill">YIELD {mapData.yieldRate}%</span>
        </div>
      </div>

      <div className="wafer-apple-shell">
        <div className="wafer-map-panel">
          <svg
            className="wafer-map-svg"
            viewBox={`0 0 ${mapData.viewWidth} ${mapData.viewHeight}`}
            role="img"
            aria-label="wafer-map"
          >
            <defs>
              <radialGradient id={`wafer_bg_${clipId}`} cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#9cc8ff" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#24344f" stopOpacity="0.12" />
              </radialGradient>
              <clipPath id={`wafer_clip_${clipId}`}>
                <circle cx={mapData.cx} cy={mapData.cy} r={mapData.radius} />
              </clipPath>
            </defs>

            <rect x="0" y="0" width={mapData.viewWidth} height={mapData.viewHeight} fill="transparent" />

            <circle
              cx={mapData.cx}
              cy={mapData.cy}
              r={mapData.radius}
              fill={`url(#wafer_bg_${clipId})`}
              stroke="#b7d6ff"
              strokeWidth="1.5"
              opacity="0.95"
            />
            <ellipse
              cx={mapData.cx - mapData.radius * 0.16}
              cy={mapData.cy - mapData.radius * 0.45}
              rx={mapData.radius * 0.34}
              ry={mapData.radius * 0.18}
              fill="#ffffff"
              opacity="0.09"
            />
            <circle
              cx={mapData.cx + mapData.radius * 0.52}
              cy={mapData.cy - mapData.radius * 0.55}
              r={mapData.radius * 0.07}
              fill="#e5f2ff"
              opacity="0.24"
            />

            <g clipPath={`url(#wafer_clip_${clipId})`}>
              <rect
                x={mapData.framePadding}
                y={mapData.framePadding}
                width={mapData.viewWidth - mapData.framePadding * 2}
                height={mapData.viewHeight - mapData.framePadding * 2}
                fill="#31415f"
                opacity="0.15"
              />
              {dies.map((die, i) => (
                <rect
                  key={`${die.x_coord}-${die.y_coord}-${i}`}
                  x={(die.x_coord - mapData.minX) * mapData.cellSize + mapData.framePadding}
                  y={(die.y_coord - mapData.minY) * mapData.cellSize + mapData.framePadding}
                  width={mapData.cellSize - 0.6}
                  height={mapData.cellSize - 0.6}
                  fill={mapData.binColors[die.hard_bin] || '#7f8da6'}
                  stroke="#d8ecff"
                  strokeOpacity="0.1"
                  strokeWidth="0.35"
                >
                  <title>{`X:${die.x_coord} Y:${die.y_coord} | HBin:${die.hard_bin} SBin:${die.soft_bin}`}</title>
                </rect>
              ))}
            </g>

            <circle
              cx={mapData.cx}
              cy={mapData.cy}
              r={mapData.radius - 0.8}
              fill="none"
              stroke="#d8ecff"
              strokeOpacity="0.34"
              strokeWidth="1"
            />
            <rect
              x={mapData.cx - mapData.radius * 0.1}
              y={mapData.cy + mapData.radius - 2}
              width={mapData.radius * 0.2}
              height="6"
              rx="2"
              fill="#a8c6e6"
              opacity="0.55"
            />
          </svg>

          <div className="wafer-legend-card">
            <div className="wafer-legend-title">HARD BIN CODES</div>
            <div className="wafer-legend-line">
              <span className="dot dot-good" />
              <span>Bin 1: Pass (Good Die) - {mapData.passDies}</span>
            </div>
            {mapData.topFailBins.map((item) => (
              <div className="wafer-legend-line" key={item.bin}>
                <span className="dot" style={{ backgroundColor: item.color }} />
                <span>
                  Bin {item.bin}: {knownBinLabel(item.bin)} - {item.count}
                </span>
              </div>
            ))}
            <div className="wafer-legend-line">
              <span className="dot dot-other" />
              <span>Other Bins - {mapData.otherBinTotal}</span>
            </div>
          </div>
        </div>

        <div className="wafer-stats-card">
          <div>Total Dies: {total_dies}</div>
          <div>Passed Dies: {mapData.passDies} ({mapData.yieldRate}%)</div>
          <div>Failed Dies: {mapData.failedDies}</div>
          <div>Edge/Null Dies: {mapData.edgeDies}</div>
          <div>Active Bins: {Object.keys(mapData.binCounts).length}</div>
        </div>
      </div>

      <div className="wafer-apple-footnote">Grid rendered from STDF PRR coordinates.</div>
    </Card>
  );
}

export default WaferMap;
