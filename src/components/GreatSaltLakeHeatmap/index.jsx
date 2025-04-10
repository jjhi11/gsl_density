import React, { useState, useEffect, useRef } from 'react';
import HeatmapRenderer from './HeatmapRenderer';
import TimeControls from './TimeControls';
import InfoPanel from './InfoPanel';
import { loadGeoJsonData, loadSiteAndTempData } from './DataLoader';
import { createSimpleGeoJSON } from './utils';

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
  const [densityData, setDensityData] = useState({});
  const [temperatureData, setTemperatureData] = useState({});
  const [densityRange, setDensityRange] = useState([1.0, 1.25]);
  const [isLoading, setIsLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);

  // --- Refs for animation ---
  const playTimerRef = useRef(null);
  
  // --- Constants ---
  const ANIMATION_INTERVAL = 500;
  
  // --- Derived State ---
  const currentTimePoint = timePoints[currentTimeIndex] || '';

  // --- Initial Data Loading Effect ---
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      
      // 1. Load GeoJSON data for the lake outline
      try {
        const geoJsonResult = await loadGeoJsonData();
        setLakeData(geoJsonResult.data);
        if (geoJsonResult.error) {
          setError(geoJsonResult.error);
        }
      } catch (err) {
        console.error('Error in GeoJSON loading:', err);
        setError('Failed to load lake outline. Using simplified version.');
        setLakeData(createSimpleGeoJSON());
      }
      
      // 2. Load site data and temperature data
      try {
        const dataResult = await loadSiteAndTempData();
        
        setStations(dataResult.stations);
        setTimePoints(dataResult.timePoints);
        setDensityData(dataResult.densityData);
        setTemperatureData(dataResult.temperatureData);
        setDensityRange(dataResult.densityRange);
        setCurrentTimeIndex(dataResult.timePoints.length > 0 ? dataResult.timePoints.length - 1 : 0);
        
        if (dataResult.usingMockData) {
          setUsingMockData(true);
        }
        
        if (dataResult.error) {
          setError(dataResult.error);
        }
      } catch (err) {
        console.error('Error in data loading:', err);
        setError('Failed to load data. Using simulated data.');
        setUsingMockData(true);
      }
      
      setIsLoading(false);
    }
    
    loadData();
  }, []);

  // --- Animation Effect ---
  useEffect(() => {
    if (playing) {
      playTimerRef.current = setInterval(() => {
        setCurrentTimeIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= timePoints.length) {
            setPlaying(false);
            return timePoints.length - 1;
          }
          return nextIndex;
        });
      }, ANIMATION_INTERVAL);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }
    
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [playing, timePoints.length]);

  // --- Render ---
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-blue-800">
        Great Salt Lake Density Heatmap
      </h2>
      <p className="text-center mb-4 text-gray-600 text-sm sm:text-base">
        Monthly Density and Temperature Visualization
      </p>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 text-center text-yellow-800 bg-yellow-50 rounded border border-yellow-200 text-sm">
          <strong>Warning:</strong> {error}
        </div>
      )}
      
      {usingMockData && (
        <div className="mb-4 p-3 text-center text-blue-800 bg-blue-50 rounded border border-blue-200 text-sm">
          <strong>Note:</strong> Using simulated data for demonstration as the external API is currently unavailable.
        </div>
      )}

      {/* Visualization Area */}
      <div className="mb-6 bg-gray-50 rounded-lg p-2 sm:p-4 shadow-inner relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <p className="text-lg text-blue-600 animate-pulse">Loading data...</p>
          </div>
        )}
        
        {/* Heatmap */}
        <HeatmapRenderer
          lakeData={lakeData}
          stations={stations}
          timePoints={timePoints}
          currentTimePoint={currentTimePoint}
          densityData={densityData}
          temperatureData={temperatureData}
          densityRange={densityRange}
          isLoading={isLoading}
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

      {/* Data Information */}
      <div className="mt-4 mb-4 p-3 text-sm text-gray-700 bg-gray-50 rounded-lg">
        <p className="font-medium mb-1">Data Sources:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Temperature data from uploaded Great Salt Lake historical records (2000-2025)</li>
          <li>Density values calculated from salinity measurements or simulated when unavailable</li>
          <li>Lake outline from Utah Geological Survey or simplified approximation</li>
        </ol>
      </div>

      {/* Interpretation Guide */}
      <InfoPanel />
    </div>
  );
};

export default GreatSaltLakeHeatmap;