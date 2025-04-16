// TimeSeriesChart.jsx
import React, { useMemo } from 'react';
import * as d3 from 'd3';

/**
 * Component to display time series data for a selected station
 */
const TimeSeriesChart = ({ 
  stationId, 
  stationName, 
  timePoints, 
  variableData, 
  variableConfig,
  onClose,
  height = 300 
}) => {
  // Prepare data for the chart - move useMemo before any conditional returns
  const chartData = useMemo(() => {
    if (!stationId || !timePoints || !variableData) {
      return [];
    }
    
    return timePoints.map(timePoint => {
      const dataPoint = {
        timePoint,
        date: parseTimePoint(timePoint),
        value: variableData[timePoint]?.[stationId]
      };
      return dataPoint;
    }).filter(point => point.value !== undefined && point.value !== null);
  }, [timePoints, variableData, stationId]);

  // Early return if missing required props
  if (!stationId || !timePoints || !variableData || !variableConfig) {
    return null;
  }

  // Helper to convert timePoint "YYYY-MM" to Date
  function parseTimePoint(timePoint) {
    const [year, month] = timePoint.split('-').map(Number);
    return new Date(year, month - 1, 1); // Month is 0-indexed in JS Date
  }

  // Format date for display
  function formatDate(date) {
    return date.toLocaleDateString(undefined, { 
      year: 'numeric',
      month: 'short'
    });
  }

  // Return empty if no data found for the selected station
  if (chartData.length === 0) {
    return (
      <div className="chart-container p-4 border rounded-lg bg-white shadow-md mb-4">
        <div className="flex justify-between mb-2">
          <h3 className="text-lg font-semibold">{stationName} - No Data Available</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <p className="text-gray-600">No {variableConfig.label} data available for this station.</p>
      </div>
    );
  }

  // Calculate dimensions
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const width = 800 - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Create scales
  const xScale = d3.scaleTime()
    .domain(d3.extent(chartData, d => d.date))
    .range([0, width]);

  // Add 5% padding to y-axis
  const yMin = d3.min(chartData, d => d.value);
  const yMax = d3.max(chartData, d => d.value);
  const yPadding = (yMax - yMin) * 0.05;
  
  const yScale = d3.scaleLinear()
    .domain([yMin - yPadding, yMax + yPadding])
    .range([innerHeight, 0]);

  // Create line generator
  const line = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.value))
    .curve(d3.curveMonotoneX);

  // Create formatted tick values for x-axis
  const xTicks = chartData.length > 12 
    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 10) === 0).map(d => d.date)
    : chartData.map(d => d.date);

  return (
    <div className="chart-container p-4 border rounded-lg bg-white shadow-md mb-4">
      <div className="flex justify-between mb-2">
        <h3 className="text-lg font-semibold">
          {stationName} - {variableConfig.label} Over Time
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
      </div>
      
      <svg width="100%" height={height} viewBox={`0 0 ${width + margin.left + margin.right} ${height}`}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* X axis */}
          <g transform={`translate(0,${innerHeight})`} className="x-axis">
            {xTicks.map((tick, i) => (
              <g key={i} transform={`translate(${xScale(tick)},0)`}>
                <line y2="6" stroke="#ccc" />
                <text
                  y="9"
                  dy="0.71em"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {formatDate(tick)}
                </text>
              </g>
            ))}
            <line x1="0" y1="0" x2={width} y2="0" stroke="#ccc" />
            <text
              x={width / 2}
              y="35"
              textAnchor="middle"
              fill="#666"
              fontSize="12"
            >
              Date
            </text>
          </g>

          {/* Y axis */}
          <g className="y-axis">
            {yScale.ticks(5).map((tick, i) => (
              <g key={i} transform={`translate(0,${yScale(tick)})`}>
                <line x2="-6" stroke="#ccc" />
                <text
                  x="-9"
                  dy="0.32em"
                  textAnchor="end"
                  fontSize="10"
                  fill="#666"
                >
                  {tick.toFixed(variableConfig.precision)}
                </text>
                <line x1="0" y1="0" x2={width} y2="0" stroke="#ddd" strokeDasharray="2,2" />
              </g>
            ))}
            <line x1="0" y1="0" x2="0" y2={innerHeight} stroke="#ccc" />
            <text
              transform={`translate(-40,${innerHeight/2}) rotate(-90)`}
              textAnchor="middle"
              fill="#666"
              fontSize="12"
            >
              {variableConfig.label} ({variableConfig.unit})
            </text>
          </g>

          {/* Line */}
          <path
            d={line(chartData)}
            fill="none"
            stroke={variableConfig.color || "#2563eb"}
            strokeWidth="2"
          />

          {/* Data points */}
          {chartData.map((d, i) => (
            <circle
              key={i}
              cx={xScale(d.date)}
              cy={yScale(d.value)}
              r="4"
              fill={variableConfig.color || "#2563eb"}
              stroke="#fff"
              strokeWidth="1"
            >
              <title>{`${formatDate(d.date)}: ${d.value.toFixed(variableConfig.precision)} ${variableConfig.unit}`}</title>
            </circle>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default TimeSeriesChart;