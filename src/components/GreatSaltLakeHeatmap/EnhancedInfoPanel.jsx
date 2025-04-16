// Enhanced InfoPanel.jsx with tooltip functionality
import React, { useState } from 'react';

/**
 * Enhanced information panel with tooltips and more prominent legend
 */
const EnhancedInfoPanel = ({ currentVariable = 'density' }) => {
  // State for handling tooltip visibility
  const [activeTooltip, setActiveTooltip] = useState(null);
  
  // Tooltip definitions for technical terms
  const tooltips = {
    density: {
      title: "LAB-DEN (g/cm³)",
      content: "Laboratory-measured water density in grams per cubic centimeter. Higher values indicate greater salt concentration. Pure water has a density of 1.0 g/cm³, while the Great Salt Lake water typically ranges from 1.05-1.25 g/cm³."
    },
    salinity: {
      title: "Salinity EOS (g/L)",
      content: "Total dissolved salt content measured in grams per liter. The Great Salt Lake is hypersaline with values typically between 50-250 g/L. For comparison, ocean water averages around 35 g/L."
    },
    idw: {
      title: "Inverse Distance Weighting",
      content: "A mathematical interpolation method that estimates values between known data points. Values closer to sampling stations are more influenced by those stations' measurements."
    }
  };
  
  // Handle showing tooltip
  const showTooltip = (id) => {
    setActiveTooltip(id);
  };
  
  // Handle hiding tooltip
  const hideTooltip = () => {
    setActiveTooltip(null);
  };
  
  // Tooltip Component
  const Tooltip = ({ id, children }) => {
    return (
      <span 
        className="tooltip-trigger"
        onMouseEnter={() => showTooltip(id)}
        onMouseLeave={hideTooltip}
        style={{
          borderBottom: '1px dashed #4b5563',
          cursor: 'help',
          position: 'relative',
          display: 'inline-block'
        }}
      >
        {children}
        {activeTooltip === id && (
          <div 
            className="tooltip-content"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'white',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              borderRadius: '4px',
              padding: '8px 12px',
              zIndex: 100,
              width: '240px',
              textAlign: 'left',
              fontSize: '12px',
              lineHeight: '1.4',
              marginBottom: '8px'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e40af' }}>
              {tooltips[id].title}
            </div>
            <div style={{ color: '#4b5563' }}>
              {tooltips[id].content}
            </div>
            <div 
              style={{
                position: 'absolute',
                bottom: '-6px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '12px',
                height: '12px',
                backgroundColor: 'white',
                boxShadow: '2px 2px 2px rgba(0,0,0,0.1)',
                transform: 'translateX(-50%) rotate(45deg)'
              }}
            />
          </div>
        )}
      </span>
    );
  };

  // Current variable color for the legend box
  const variableColor = currentVariable === 'density' ? '#2563eb' : '#10b981';
  const variableName = currentVariable === 'density' ? 'LAB-DEN' : 'Salinity EOS';
  const variableUnit = currentVariable === 'density' ? 'g/cm³' : 'g/L';

  return (
    <div className="info-panel">
      {/* Prominent Legend */}
      <div className="legend-box mb-4 p-4 bg-white border rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-2">Map Legend</h3>
        <div className="flex items-center">
          <div className="w-32 h-6 rounded" style={{ 
            background: `linear-gradient(to right, ${currentVariable === 'density' ? '#e0f2fe, #2563eb' : '#dcfce7, #10b981'})` 
          }} />
          <div className="ml-3 text-sm">
            <div>
              {currentVariable === 'density' ? 'Lower density' : 'Lower salinity'} → {currentVariable === 'density' ? 'Higher density' : 'Higher salinity'}
            </div>
            <div className="text-gray-600 text-xs mt-1">
              Showing <Tooltip id={currentVariable}>{variableName}</Tooltip> ({variableUnit})
            </div>
          </div>
        </div>
        
        <div className="flex items-center mt-3">
          <div className="flex items-center mr-4">
            <svg width="16" height="16" className="mr-1">
              <circle cx="8" cy="8" r="6" fill={variableColor} stroke="#333" strokeWidth="1" />
            </svg>
            <span className="text-sm">Sampling station with data</span>
          </div>
          <div className="flex items-center">
            <svg width="16" height="16" className="mr-1">
              <circle cx="8" cy="8" r="6" fill="#ccc" stroke="#333" strokeWidth="1" />
            </svg>
            <span className="text-sm">No data for this month</span>
          </div>
        </div>
      </div>
      
      {/* Interpretation Guide */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-2 text-blue-800">Interpretation Guide</h3>
        <div className="bg-blue-50 p-4 rounded-lg">
          <ul className="text-left pl-5 text-gray-700 m-0">
            <li className="mb-1">
              The map shows interpolated <Tooltip id={currentVariable}>{variableName}</Tooltip> values between sampling stations.
            </li>
            <li className="mb-1">
              Values between stations are calculated using <Tooltip id="idw">inverse distance weighting</Tooltip>.
            </li>
            <li className="mb-1">
              <strong>Click on any station</strong> to view its data in a time series chart.
            </li>
            <li className="mb-1">
              Use the slider or play button to explore monthly changes (2000-2025).
            </li>
            <li className="mb-1">
              The north and south arms of the lake show different patterns due to the causeway that divides them.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EnhancedInfoPanel;