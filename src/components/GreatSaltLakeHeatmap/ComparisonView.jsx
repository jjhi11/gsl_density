// ComparisonView.jsx
// Component for displaying two time points or variables side by side
import React, { useState, useEffect } from 'react';
import HeatmapRenderer from './HeatmapRenderer';

/**
 * Component for side-by-side comparison of heatmaps
 */
const ComparisonView = ({
  lakeData,
  stations,
  timePoints,
  allData,
  variableConfigs,
  selectedVariable,
  currentTimeIndex,
  onStationClick,
  isLoading
}) => {
  // State for the comparison point
  const [comparisonTimeIndex, setComparisonTimeIndex] = useState(0);
  const [comparisonType, setComparisonType] = useState('time'); // 'time' or 'variable'
  const [comparisonVariable, setComparisonVariable] = useState(
    selectedVariable === 'density' ? 'salinity' : 'density'
  );

  // Update comparison point when primary selections change
  useEffect(() => {
    // If comparing time, ensure comparison isn't the same as current
    if (comparisonType === 'time' && comparisonTimeIndex === currentTimeIndex) {
      const newIndex = currentTimeIndex > 0 
        ? currentTimeIndex - 1 
        : (timePoints.length > 1 ? 1 : 0);
      setComparisonTimeIndex(newIndex);
    }
    
    // If comparing variables, ensure we're not comparing same variable
    if (comparisonType === 'variable' && comparisonVariable === selectedVariable) {
      const variables = Object.keys(variableConfigs);
      const otherVariables = variables.filter(v => v !== selectedVariable && v !== 'temperature');
      if (otherVariables.length > 0) {
        setComparisonVariable(otherVariables[0]);
      }
    }
  }, [currentTimeIndex, selectedVariable, comparisonType, comparisonTimeIndex, comparisonVariable, timePoints, variableConfigs]);

  // Get current timepoints
  const currentTimePoint = timePoints[currentTimeIndex] || '';
  const comparisonTimePoint = timePoints[comparisonTimeIndex] || '';
  
  // Get variable data based on comparison type
  const primaryVariableData = allData[selectedVariable] || {};
  const comparisonVariableData = comparisonType === 'variable' 
    ? (allData[comparisonVariable] || {})
    : primaryVariableData;

  // Get data for specific timepoints
  const primaryDataForTimepoint = primaryVariableData[currentTimePoint] || {};
  const comparisonDataForTimepoint = comparisonType === 'time'
    ? (primaryVariableData[comparisonTimePoint] || {})
    : (comparisonVariableData[currentTimePoint] || {});
  
  // Get config objects
  const primaryConfig = variableConfigs[selectedVariable] || {};
  const comparisonConfig = comparisonType === 'variable'
    ? (variableConfigs[comparisonVariable] || {})
    : primaryConfig;
  
  // Get temperature data
  const currentTemperature = allData.temperature 
    ? allData.temperature[currentTimePoint] 
    : undefined;
  
  const comparisonTemperature = comparisonType === 'time' && allData.temperature
    ? allData.temperature[comparisonTimePoint]
    : currentTemperature;

  // Format date for display
  const formatTimePoint = (timePoint) => {
    if (!timePoint) return '';
    const [year, month] = timePoint.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long'
    });
  };

  // Handle selection of comparison time
  const handleComparisonTimeChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    if (newIndex >= 0 && newIndex < timePoints.length) {
      setComparisonTimeIndex(newIndex);
    }
  };

  // Handle changing comparison type
  const handleComparisonTypeChange = (e) => {
    setComparisonType(e.target.value);
  };

  // Handle changing comparison variable
  const handleComparisonVariableChange = (e) => {
    setComparisonVariable(e.target.value);
  };

  return (
    <div className="comparison-view bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-blue-800">Comparison View</h3>
        
        <div className="flex space-x-4">
          {/* Comparison type selector */}
          <div>
            <label htmlFor="comparison-type" className="block text-sm font-medium text-gray-700 mb-1">
              Compare by:
            </label>
            <select
              id="comparison-type"
              value={comparisonType}
              onChange={handleComparisonTypeChange}
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="time">Time Period</option>
              <option value="variable">Variable</option>
            </select>
          </div>
          
          {/* Comparison value selector - conditional based on type */}
          {comparisonType === 'time' ? (
            <div>
              <label htmlFor="comparison-time" className="block text-sm font-medium text-gray-700 mb-1">
                Compare with:
              </label>
              <select
                id="comparison-time"
                value={comparisonTimeIndex}
                onChange={handleComparisonTimeChange}
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {timePoints.map((tp, idx) => (
                  <option key={idx} value={idx} disabled={idx === currentTimeIndex}>
                    {formatTimePoint(tp)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="comparison-variable" className="block text-sm font-medium text-gray-700 mb-1">
                Compare with:
              </label>
              <select
                id="comparison-variable"
                value={comparisonVariable}
                onChange={handleComparisonVariableChange}
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {Object.keys(variableConfigs)
                  .filter(v => v !== 'temperature' && v !== selectedVariable)
                  .map(v => (
                    <option key={v} value={v}>
                      {variableConfigs[v].label}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>
      
      {/* Display two heatmaps side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary heatmap */}
        <div className="comparison-left">
          <div className="text-center mb-2 font-medium text-blue-700">
            {selectedVariable === 'density' ? 'Density' : 'Salinity'}: {formatTimePoint(currentTimePoint)}
          </div>
          <HeatmapRenderer
            lakeData={lakeData}
            stations={stations}
            currentDataForTimepoint={primaryDataForTimepoint}
            currentTemperature={currentTemperature}
            currentRange={primaryConfig.defaultRange || [1.0, 1.25]}
            currentConfig={primaryConfig}
            currentTimePoint={currentTimePoint}
            isLoading={isLoading}
            onStationClick={onStationClick}
            hideTitle={true}
          />
        </div>
        
        {/* Comparison heatmap */}
        <div className="comparison-right">
          <div className="text-center mb-2 font-medium text-blue-700">
            {comparisonType === 'time' 
              ? `${selectedVariable === 'density' ? 'Density' : 'Salinity'}: ${formatTimePoint(comparisonTimePoint)}` 
              : `${comparisonVariable === 'density' ? 'Density' : 'Salinity'}: ${formatTimePoint(currentTimePoint)}`}
          </div>
          <HeatmapRenderer
            lakeData={lakeData}
            stations={stations}
            currentDataForTimepoint={comparisonDataForTimepoint}
            currentTemperature={comparisonTemperature}
            currentRange={comparisonConfig.defaultRange || [1.0, 1.25]}
            currentConfig={comparisonConfig}
            currentTimePoint={comparisonType === 'time' ? comparisonTimePoint : currentTimePoint}
            isLoading={isLoading}
            onStationClick={onStationClick}
            hideTitle={true}
          />
        </div>
      </div>
      
      {/* Comparison insights */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
        <p className="font-medium mb-1">Comparison Insights:</p>
        <ul className="list-disc pl-5">
          {comparisonType === 'time' ? (
            <>
              <li>Compare how conditions have changed between {formatTimePoint(comparisonTimePoint)} and {formatTimePoint(currentTimePoint)}.</li>
              <li>Look for seasonal patterns or long-term trends in the data.</li>
            </>
          ) : (
            <>
              <li>Observe the relationship between {primaryConfig.label} ({primaryConfig.unit}) and {comparisonConfig.label} ({comparisonConfig.unit}).</li>
              <li>Areas with similar patterns may indicate correlation between these variables.</li>
            </>
          )}
          <li>Click on any station to view detailed time series data.</li>
        </ul>
      </div>
    </div>
  );
};

export default ComparisonView;