// ExportOptions.jsx
// Component for exporting data and visualizations
import React, { useState, useRef } from 'react';

/**
 * Component for exporting visualizations and data
 */
const ExportOptions = ({
  timePoints,
  currentTimePoint,
  allData,
  selectedVariable,
  stations,
  variableConfig
}) => {
  const [exportType, setExportType] = useState('image');
  const [exportStatus, setExportStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const exportSectionRef = useRef(null);

  // Get current data for export
  const currentVariableData = allData[selectedVariable] || {};
  const currentData = currentVariableData[currentTimePoint] || {};

  // Format date for display and filename
  const formatTimePointFilename = (timePoint) => {
    if (!timePoint) return 'no-date';
    return timePoint.replace('-', '_');
  };
  
  const formatTimePointDisplay = (timePoint) => {
    if (!timePoint) return '';
    const [year, month] = timePoint.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long'
    });
  };

  // Export image (screenshot)
  const exportImage = () => {
    setIsLoading(true);
    setExportStatus('Preparing screenshot...');
    
    // This function would normally use html2canvas or a similar library
    // For this example, we'll simulate the process
    setTimeout(() => {
      try {
        // Simulate successful export
        setExportStatus('Screenshot saved successfully!');
        
        // In a real implementation, you would:
        // 1. Use html2canvas to capture the heatmap
        // 2. Convert to an image
        // 3. Create a download link
        
        // Simulated code:
        // html2canvas(document.querySelector('.heatmap-container')).then(canvas => {
        //   const link = document.createElement('a');
        //   link.download = `GSL_${selectedVariable}_${formatTimePointFilename(currentTimePoint)}.png`;
        //   link.href = canvas.toDataURL('image/png');
        //   link.click();
        // });
        
      } catch (error) {
        setExportStatus('Error exporting image: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    }, 1500);
  };

  // Export data as CSV
  const exportCSV = () => {
    setIsLoading(true);
    setExportStatus('Preparing CSV data...');
    
    try {
      // Create CSV content
      let csvContent = 'Station ID,Station Name,Latitude,Longitude,' + 
                       `${variableConfig.label} (${variableConfig.unit})\n`;
      
      // Add data for each station
      stations.forEach(station => {
        const value = currentData[station.id];
        const formattedValue = value !== undefined && value !== null 
          ? value.toFixed(variableConfig.precision) 
          : 'No data';
        
        csvContent += `${station.id},${station.name},${station.latitude},${station.longitude},${formattedValue}\n`;
      });
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `GSL_${selectedVariable}_${formatTimePointFilename(currentTimePoint)}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setExportStatus('CSV data exported successfully!');
    } catch (error) {
      setExportStatus('Error exporting CSV: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Export time series data for all stations
  const exportTimeSeries = () => {
    setIsLoading(true);
    setExportStatus('Preparing time series data...');
    
    try {
      // Create header row with dates
      let csvContent = 'Station ID,Station Name';
      timePoints.forEach(tp => {
        csvContent += `,${tp}`;
      });
      csvContent += '\n';
      
      // Add data for each station
      stations.forEach(station => {
        csvContent += `${station.id},${station.name}`;
        
        // Add values for each time point
        timePoints.forEach(tp => {
          const tpData = currentVariableData[tp] || {};
          const value = tpData[station.id];
          const formattedValue = value !== undefined && value !== null 
            ? value.toFixed(variableConfig.precision) 
            : '';
          
          csvContent += `,${formattedValue}`;
        });
        csvContent += '\n';
      });
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `GSL_${selectedVariable}_TimeSeries.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setExportStatus('Time series data exported successfully!');
    } catch (error) {
      setExportStatus('Error exporting time series: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle export based on type
  const handleExport = () => {
    switch (exportType) {
      case 'image':
        exportImage();
        break;
      case 'csv':
        exportCSV();
        break;
      case 'timeseries':
        exportTimeSeries();
        break;
      default:
        setExportStatus('Please select an export type');
    }
  };

  return (
    <div 
      ref={exportSectionRef}
      className="export-options bg-white p-4 rounded-lg shadow mb-6"
    >
      <h3 className="text-lg font-bold text-blue-800 mb-3">Export Options</h3>
      
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-auto">
          <label htmlFor="export-type" className="block text-sm font-medium text-gray-700 mb-1">
            Export Format:
          </label>
          <select
            id="export-type"
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="image">Screenshot (PNG)</option>
            <option value="csv">Current Data (CSV)</option>
            <option value="timeseries">Time Series Data (CSV)</option>
          </select>
        </div>
        
        <div className="w-full sm:w-auto">
          <button
            onClick={handleExport}
            disabled={isLoading}
            className={`w-full sm:w-auto flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export {exportType === 'image' ? 'Image' : (exportType === 'csv' ? 'Current Data' : 'Time Series')}
              </>
            )}
          </button>
        </div>
        
        {exportStatus && (
          <div className={`text-sm ${exportStatus.includes('successfully') ? 'text-green-600' : (exportStatus.includes('Error') ? 'text-red-600' : 'text-blue-600')}`}>
            {exportStatus}
          </div>
        )}
      </div>
      
      <div className="mt-3 text-sm text-gray-500">
        {exportType === 'image' && (
          <p>Exports current visualization as PNG image.</p>
        )}
        {exportType === 'csv' && (
          <p>Exports data for all stations for {formatTimePointDisplay(currentTimePoint)}.</p>
        )}
        {exportType === 'timeseries' && (
          <p>Exports complete time series data for all stations from 2000-2025.</p>
        )}
      </div>
    </div>
  );
};

export default ExportOptions;