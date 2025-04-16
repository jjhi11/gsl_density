// InteractiveStationMarker.jsx
import React, { useState, useMemo } from 'react';

/**
 * Interactive station marker with hover preview
 */
const InteractiveStationMarker = ({
  station,
  value,
  projected,
  colorScale,
  onClick,
  variableConfig
}) => {
  const [isHovering, setIsHovering] = useState(false);

  // Station coordinates
  const [x, y] = projected;
  
  // Check if we have valid data for this station
  const hasData = value !== undefined && value !== null && typeof value === 'number' && !isNaN(value);
  
  // Determine fill color based on data availability
  const fillColor = hasData ? colorScale(value) : "#ccc";
  
  // Calculate optimal label position (avoid edges of map)
  const labelX = station.id === 'SJ-1' ? -2 : (station.id === 'RD1' ? 8 : 0);
  const labelY = station.id === 'RD1' ? -10 : 15;
  
  // Format the value with proper precision
  const formattedValue = hasData ? value.toFixed(variableConfig.precision) : 'No data';
  
  // Preview card content 
  const previewCard = useMemo(() => {
    if (!isHovering) return null;
    
    return (
      <g transform={`translate(${x + 20}, ${y - 20})`}>
        {/* Card background with shadow effect */}
        <rect
          x="-10"
          y="-10"
          width="160"
          height="90"
          rx="4"
          fill="white"
          stroke="#e5e7eb"
          strokeWidth="1"
          filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.1))"
        />
        
        {/* Station name */}
        <text
          x="10"
          y="15"
          fontSize="14"
          fontWeight="bold"
          fill="#1e40af"
        >
          {station.name}
        </text>
        
        {/* Station ID */}
        <text
          x="10"
          y="35"
          fontSize="12"
          fill="#4b5563"
        >
          ID: {station.id}
        </text>
        
        {/* Current value with units */}
        <text
          x="10"
          y="55"
          fontSize="12"
          fill="#4b5563"
        >
          {variableConfig.label}: {formattedValue} {hasData ? variableConfig.unit : ''}
        </text>
        
        {/* Action hint */}
        <text
          x="10"
          y="75"
          fontSize="10"
          fill="#6b7280"
          fontStyle="italic"
        >
          Click for time series data
        </text>
        
        {/* Connecting line to station */}
        <line
          x1="-15"
          y1="25"
          x2="-30"
          y2="30"
          stroke="#9ca3af"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      </g>
    );
  }, [isHovering, x, y, station, hasData, formattedValue, variableConfig]);

  return (
    <g
      className="station-marker"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => onClick(station)}
      style={{ cursor: 'pointer' }}
    >
      {/* Station circle with pulsing effect when hovering */}
      <circle
        cx={x}
        cy={y}
        r={isHovering ? 7 : 5}
        fill={fillColor}
        stroke="#333"
        strokeWidth="1"
        opacity={isHovering ? 0.9 : 1}
      >
        {/* Animation for pulsing effect on hover */}
        {isHovering && (
          <animate
            attributeName="r"
            values="5;7;5"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      
      {/* Station label (always visible) */}
      <text
        x={x + labelX}
        y={y + labelY}
        textAnchor="middle"
        fontSize="10"
        fontFamily="sans-serif"
        fill="#333"
        fontWeight={isHovering ? "bold" : "normal"}
      >
        {station.name}
      </text>
      
      {/* Preview card (only visible on hover) */}
      {previewCard}
    </g>
  );
};

export default InteractiveStationMarker;