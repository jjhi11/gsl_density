// index.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import HeatmapRenderer from './HeatmapRenderer';
import TimeControls from './TimeControls';
import InfoPanel from './InfoPanel';
import { loadGeoJsonData, loadSiteAndTempData } from './DataLoader';
import { createSimpleGeoJSON } from './utils';
// Removed Legend import as it's used within HeatmapRenderer

/**
 * Great Salt Lake Heatmap - Main Component
 * Orchestrates data loading, state management, and renders the visualization
 */
const GreatSaltLakeHeatmap = () => {
  // --- State Hooks ---
  const [lakeData, setLakeData] = useState(null);
  const [stations, setStations] = useState([]);
  const [timePoints, setTimePoints] = useState([]);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [allData, setAllData] = useState({}); // Holds { density: {...}, salinity: {...}, temperature: {...} }
  const [dataRanges, setDataRanges] = useState({}); // Holds { density: [min, max], salinity: [min, max] }
  const [selectedVariable, setSelectedVariable] = useState('density'); // Default variable
  const [availableVariables, setAvailableVariables] = useState(['density']); // Start with density
  const [isLoading, setIsLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);

  // --- Refs for animation ---
  const playTimerRef = useRef(null);

  // --- Constants ---
  const ANIMATION_INTERVAL = 500;

  // --- Variable Configuration ---
  const VARIABLE_CONFIG = useMemo(() => ({
    density: {
        key: 'density',
        label: 'LAB-DEN', // User requested label
        unit: 'g/cm³',
        precision: 3,
        interpolate: 'interpolateBlues',
        defaultRange: [1.0, 1.25]
    },
    salinity: {
        key: 'salinity',
        label: 'Salinity EOS', // User requested label
        unit: 'g/L',
        precision: 1,
        interpolate: 'interpolateGreens', // Different color for salinity
        defaultRange: [50, 250]
    },
     temperature: { // Keep temp config for info text if needed
         key: 'temperature',
         label: 'Avg Temp',
         unit: '°F',
         precision: 1,
         interpolate: 'interpolateOrRd',
         defaultRange: [0, 100]
     }
  }), []);


  // --- Initial Data Loading Effect ---
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      setUsingMockData(false);

      // 1. Load GeoJSON
      try {
        const geoJsonResult = await loadGeoJsonData();
        setLakeData(geoJsonResult.data || createSimpleGeoJSON()); // Use simple GeoJSON as fallback
        if (geoJsonResult.error) {
          setError(prev => prev ? `${prev}. ${geoJsonResult.error}` : geoJsonResult.error);
        }
      } catch (err) {
        console.error('Error in GeoJSON loading:', err);
        setError('Failed to load lake outline. Using simplified version.');
        setLakeData(createSimpleGeoJSON());
      }

      // 2. Load site, density, salinity, and temperature data
      try {
        const dataResult = await loadSiteAndTempData();

        setStations(dataResult.stations);
        setTimePoints(dataResult.timePoints);
        setAllData(dataResult.allData || {});
        setDataRanges(dataResult.dataRanges || {});

        // Set available variables, excluding temperature for heatmap selection
        const heatmapVariables = Object.keys(dataResult.allData || {})
           .filter(key => key === 'density' || key === 'salinity'); // Only allow density and salinity for now
        setAvailableVariables(heatmapVariables.length > 0 ? heatmapVariables : ['density']);

        // Set initial selection and time index
        const defaultVar = 'density';
        setSelectedVariable(heatmapVariables.includes(defaultVar) ? defaultVar : heatmapVariables[0] || '');
        setCurrentTimeIndex(dataResult.timePoints.length > 0 ? dataResult.timePoints.length - 1 : 0);

        if (dataResult.usingMockData) {
          setUsingMockData(true);
        }
        if (dataResult.error) {
          setError(prev => prev ? `${prev}. ${dataResult.error}` : dataResult.error);
        }
      } catch (err) {
        console.error('Error in data loading:', err);
        setError(`Failed to load site data: ${err.message}. Using simulated data.`);
        setUsingMockData(true);
        setAvailableVariables(['density', 'salinity']); // Assume mock gives both
        setSelectedVariable('density');
        // Set some default mock structures if loader completely failed
        setAllData({ density: {}, salinity: {}, temperature: {} });
        setDataRanges({ density: [1.05, 1.20], salinity: [50, 250] });
      }

      setIsLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Animation Effect (Keep as is) ---
   useEffect(() => {
     if (playing) {
       playTimerRef.current = setInterval(() => {
         setCurrentTimeIndex(prevIndex => {
           const nextIndex = prevIndex + 1;
           if (nextIndex >= timePoints.length) {
             setPlaying(false); // Stop at the end
             return timePoints.length - 1;
           }
           return nextIndex;
         });
       }, ANIMATION_INTERVAL);
     } else if (playTimerRef.current) {
       clearInterval(playTimerRef.current);
     }
     return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
   }, [playing, timePoints.length]);

  // --- Derived State based on selection ---
  const currentTimePoint = timePoints[currentTimeIndex] || '';

  const currentVariableData = useMemo(() => {
      return allData[selectedVariable] || {};
  }, [allData, selectedVariable]);

  const currentDataForTimepoint = useMemo(() => {
      return currentVariableData[currentTimePoint] || {};
  }, [currentVariableData, currentTimePoint]);

  const currentRange = useMemo(() => {
      return dataRanges[selectedVariable] || VARIABLE_CONFIG[selectedVariable]?.defaultRange || [0, 1];
  }, [dataRanges, selectedVariable, VARIABLE_CONFIG]);

   const currentConfig = useMemo(() => {
       // Ensure a fallback config object exists
      return VARIABLE_CONFIG[selectedVariable] || {
          key: selectedVariable,
          label: selectedVariable,
          unit: '',
          precision: 2,
          interpolate: 'interpolateBlues',
          defaultRange: [0,1]
      };
  }, [selectedVariable, VARIABLE_CONFIG]);

  const currentTemperature = useMemo(() => {
     return allData.temperature ? allData.temperature[currentTimePoint] : undefined;
  }, [allData, currentTimePoint]);


  // --- Variable Selector Component ---
  const VariableSelector = ({ variables, selectedVar, onChange, isLoading }) => {
    const styles = {
        container: { marginBottom: '1rem', textAlign: 'center' },
        label: { marginRight: '0.5rem', fontWeight: '500', fontSize: '0.9rem', color: '#374151' },
        select: {
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '0.9rem',
            backgroundColor: isLoading ? '#e9ecef' : 'white',
            cursor: isLoading ? 'not-allowed' : 'pointer'
         }
    };
    return (
        <div style={styles.container}>
            <label htmlFor="variable-select" style={styles.label}>Show:</label>
            <select
                id="variable-select"
                value={selectedVar}
                onChange={(e) => onChange(e.target.value)}
                disabled={isLoading || variables.length <= 1}
                style={styles.select}
            >
                {variables.map(variable => (
                    <option key={variable} value={variable}>
                        {/* Use label from config, fallback to variable name */}
                        {VARIABLE_CONFIG[variable]?.label || variable}
                        {/* Add unit in parentheses */}
                        {VARIABLE_CONFIG[variable]?.unit ? ` (${VARIABLE_CONFIG[variable].unit})` : ''}
                    </option>
                ))}
            </select>
        </div>
    );
  };

  // --- Data Information Component (Keep as is) ---
  const DataInformation = () => { /* ... */ };

  // --- Render ---
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-blue-800">
        Great Salt Lake Heatmap
      </h2>
      <p className="text-center mb-4 text-gray-600 text-sm sm:text-base">
        Monthly Chemical Conditions Visualization
      </p>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 text-center text-yellow-800 bg-yellow-50 rounded border border-yellow-200 text-sm">
          <strong>Warning:</strong> {error}
        </div>
      )}
      {usingMockData && !error && ( // Show mock data note only if no other error
        <div className="mb-4 p-3 text-center text-blue-800 bg-blue-50 rounded border border-blue-200 text-sm">
          <strong>Note:</strong> Using simulated or incomplete data for demonstration.
        </div>
      )}

       {/* ++ Add Variable Selector ++ */}
      <VariableSelector
          variables={availableVariables}
          selectedVar={selectedVariable}
          onChange={setSelectedVariable}
          isLoading={isLoading}
      />

{/* Visualization Area */}
<div className="mb-6 bg-gray-50 rounded-lg p-2 sm:p-4 shadow-inner relative">
        {/* Loading Overlay */}
        {isLoading && ( // Check if loading
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <p className="text-lg text-blue-600 animate-pulse">Loading data...</p>
          </div>
        )} {/* Closing parenthesis belongs here */}

        {/* Heatmap - ++ Update Props ++ */}
        <HeatmapRenderer
          lakeData={lakeData}
          stations={stations}
          currentDataForTimepoint={currentDataForTimepoint}
          currentTemperature={currentTemperature}
          currentRange={currentRange}
          currentConfig={currentConfig}
          currentTimePoint={currentTimePoint}
          isLoading={isLoading}
          // Pass projection if calculated here, otherwise calculate in HeatmapRenderer
        />
         {/* Time Controls */}
        <TimeControls
          playing={playing}
          setPlaying={setPlaying}
          currentTimeIndex={currentTimeIndex}
          setCurrentTimeIndex={setCurrentTimeIndex}
          timePoints={timePoints}
          currentTimePoint={currentTimePoint}
          isLoading={isLoading}
        />
      </div>
      <DataInformation />
      <InfoPanel />
    </div>
  );
};

export default GreatSaltLakeHeatmap;