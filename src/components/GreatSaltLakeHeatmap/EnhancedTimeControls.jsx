// EnhancedTimeControls.jsx
import React, { useCallback, useMemo } from 'react';

/**
 * Enhanced time controls with quick select buttons and improved slider
 */
const EnhancedTimeControls = ({
  playing,
  setPlaying,
  currentTimeIndex,
  setCurrentTimeIndex,
  timePoints,
  currentTimePoint,
  isLoading
}) => {
  // Toggle between play and pause
  const togglePlay = useCallback(() => {
    setPlaying(prev => !prev);
  }, [setPlaying]);

  // Handle slider changes
  const handleSliderChange = useCallback((e) => {
    const newIndex = parseInt(e.target.value, 10);
    if (newIndex >= 0 && newIndex < timePoints.length) {
      setCurrentTimeIndex(newIndex);
      if (playing) setPlaying(false);
    }
  }, [playing, setPlaying, setCurrentTimeIndex, timePoints]);

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

  // Get year from time point
  const getYear = (timePoint) => {
    if (!timePoint) return '';
    return timePoint.split('-')[0];
  };

  // Generate quick select options
  const quickSelectOptions = useMemo(() => {
    if (!timePoints || timePoints.length === 0) return [];
    
    const currentYear = new Date().getFullYear();
    const options = [];
    
    // Find index for start of periods
    const findStartIndex = (year) => {
      const index = timePoints.findIndex(tp => getYear(tp) >= year);
      return index >= 0 ? index : 0;
    };

    // Calculate years based on available data
    const minYear = parseInt(getYear(timePoints[0]));
    const maxYear = parseInt(getYear(timePoints[timePoints.length - 1]));
    
    // Add "Last 5 Years" if we have enough data
    if (maxYear - minYear >= 5) {
      const fiveYearsAgo = maxYear - 5;
      options.push({
        label: "Last 5 Years",
        index: findStartIndex(fiveYearsAgo)
      });
    }
    
    // Add "Last Decade" if we have enough data
    if (maxYear - minYear >= 10) {
      const tenYearsAgo = maxYear - 10;
      options.push({
        label: "Last Decade",
        index: findStartIndex(tenYearsAgo)
      });
    }
    
    // Add "Start" and "End" options
    options.push({
      label: "Start",
      index: 0
    });
    
    options.push({
      label: "Latest",
      index: timePoints.length - 1
    });
    
    return options;
  }, [timePoints]);
  
  // Jump to specific year/month
  const jumpTo = (index) => {
    if (index >= 0 && index < timePoints.length) {
      setCurrentTimeIndex(index);
      if (playing) setPlaying(false);
    }
  };

  return (
    <div className="time-controls bg-gray-50 rounded-lg p-4 shadow-inner mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
        {/* Title and current time display */}
        <div className="text-center sm:text-left mb-3 sm:mb-0">
          <h3 className="text-lg font-bold text-gray-700">Time Controls</h3>
          <div className="text-2xl font-semibold text-blue-700">
            {formatTimePoint(currentTimePoint)}
          </div>
        </div>
        
        {/* Quick select buttons */}
        <div className="flex flex-wrap justify-center gap-2">
          {quickSelectOptions.map((option, idx) => (
            <button
              key={idx}
              onClick={() => jumpTo(option.index)}
              disabled={isLoading || timePoints.length <= 1}
              className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 
                        font-medium py-1 px-3 rounded-lg text-sm transition-colors 
                        focus:ring-2 focus:ring-blue-300 focus:outline-none
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Slider container with improved styling */}
      <div className="slider-container mt-4">
        <div className="relative">
          <input
            type="range"
            min="0"
            max={Math.max(0, timePoints.length - 1)}
            value={currentTimeIndex}
            onChange={handleSliderChange}
            disabled={isLoading || timePoints.length <= 1}
            className="w-full h-4 bg-blue-200 rounded-full appearance-none cursor-pointer 
                      disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              // Custom slider styling with webkit and moz prefixes
              WebkitAppearance: 'none',
              appearance: 'none',
              outline: 'none',
            }}
            // Add additional styles for thumb and track
            // These would normally be in a CSS file but inline for demonstration
            aria-valuetext={`Time point: ${currentTimePoint}`}
            aria-label="Time Point Slider"
          />
        </div>
        
        {/* Year markers */}
        <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
          {timePoints.length > 0 && (
            <>
              <span>{getYear(timePoints[0])}</span>
              <span className="hidden sm:inline">{getYear(timePoints[Math.floor(timePoints.length * 0.25)])}</span>
              <span>{getYear(timePoints[Math.floor(timePoints.length * 0.5)])}</span>
              <span className="hidden sm:inline">{getYear(timePoints[Math.floor(timePoints.length * 0.75)])}</span>
              <span>{getYear(timePoints[timePoints.length - 1])}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Play control */}
      <div className="flex justify-center mt-4">
        <button
          onClick={togglePlay}
          disabled={isLoading || timePoints.length <= 1}
          className={`flex items-center justify-center py-2 px-4 rounded-full 
                     font-medium text-white transition-colors focus:outline-none
                     focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     ${playing ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500' : 
                                'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'}`}
        >
          {playing ? (
            <>
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Play Animation
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default EnhancedTimeControls;