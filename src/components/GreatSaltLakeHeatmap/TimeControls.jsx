import React, { useCallback, useMemo } from 'react';

/**
 * Component for time controls with improved temporal visualization
 * Adds year markers and labels to the slider for better navigation
 */
const TimeControls = ({
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
    setPlaying(prev => {
      const newState = !prev;
      console.log(`Animation ${newState ? 'started' : 'stopped'}`);
      return newState;
    });
  }, [setPlaying]);

  // Handle slider changes
  const handleSliderChange = useCallback((e) => {
    const newIndex = parseInt(e.target.value, 10);
    
    // Validate the index is within bounds
    if (newIndex >= 0 && newIndex < timePoints.length) {
      setCurrentTimeIndex(newIndex);
      
      // Add debug logging
      console.log(`Time slider changed to index ${newIndex} (${timePoints[newIndex]})`);
      
      // Stop animation if playing
      if (playing) setPlaying(false);
    } else {
      console.warn(`Invalid slider index: ${newIndex}, max: ${timePoints.length - 1}`);
    }
  }, [playing, setPlaying, setCurrentTimeIndex, timePoints]);

  // Handle when user finishes moving the slider
  const handleSliderFinish = useCallback((e) => {
    const newIndex = parseInt(e.target.value, 10);
    if (newIndex >= 0 && newIndex < timePoints.length) {
      setCurrentTimeIndex(newIndex);
    }
  }, [setCurrentTimeIndex, timePoints]);
  
  // Generate year markers for the slider
  const yearMarkers = useMemo(() => {
    if (!timePoints || timePoints.length === 0) return [];
    
    return timePoints.reduce((markers, tp, index) => {
      const year = tp.split('-')[0];
      const month = tp.split('-')[1];
      
      // Add a marker at the first month of each year
      if (month === '01') {
        const position = (index / (timePoints.length - 1)) * 100;
        markers.push({ year, index, position });
      }
      return markers;
    }, []);
  }, [timePoints]);
  
  // Determine which years to show labels for (to avoid overcrowding)
  const yearsToShow = useMemo(() => {
    const years = new Set();
    
    if (yearMarkers.length <= 10) {
      // Show all years if there are 10 or fewer
      yearMarkers.forEach(marker => years.add(marker.year));
    } else {
      // Show approximately every 3-4 years
      const interval = Math.ceil(yearMarkers.length / 7); // Show about 7 labels total
      yearMarkers.forEach((marker, i) => {
        if (i % interval === 0 || i === yearMarkers.length - 1) {
          years.add(marker.year);
        }
      });
    }
    
    return years;
  }, [yearMarkers]);

  // Format date for display
  const formatTimePoint = (timePoint) => {
    if (!timePoint) return '';
    
    const [year, month] = timePoint.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    
    return date.toLocaleDateString(undefined, { 
      year: 'numeric',
      month: 'short'
    });
  };

  // Custom CSS for better slider appearance (inline styles)
  const sliderStyles = {
    WebkitAppearance: 'none',
    appearance: 'none',
    width: '100%',
    height: '8px',
    borderRadius: '9999px',
    background: '#e2e8f0',
    cursor: 'pointer',
    outline: 'none'
  };

  return (
    <div className="mt-4">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 px-2">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading || timePoints.length <= 1}
          className={`px-4 py-2 rounded-lg font-medium transition-opacity text-sm sm:text-base ${
            playing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
          } text-white shadow disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {playing ? 'Pause' : 'Play Animation'}
        </button>

        {/* Time Point Display */}
        <div className="text-xs sm:text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded-md shadow whitespace-nowrap">
          {timePoints.length > 0 ? (
            `${formatTimePoint(currentTimePoint)} (${currentTimeIndex + 1}/${timePoints.length})`
          ) : (
            isLoading ? 'Loading...' : 'No time data'
          )}
        </div>
      </div>

      {/* Time Slider with Year Markers */}
      <div className="relative mt-6 mb-6 px-2">
        {/* Year markers and labels */}
        <div className="absolute left-0 right-0 top-0 h-16 -mt-14 pointer-events-none">
          {yearMarkers.map(marker => (
            <React.Fragment key={marker.year}>
              {/* Year marker line */}
              <div 
                className="absolute h-6 w-px bg-gray-400 bottom-0"
                style={{ left: `${marker.position}%` }}
              />
              
              {/* Year label (only for selected years) */}
              {yearsToShow.has(marker.year) && (
                <div 
                  className="absolute bottom-6 transform -translate-x-1/2 text-xs font-medium text-gray-600"
                  style={{ left: `${marker.position}%` }}
                >
                  {marker.year}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        
        {/* Quarter markers */}
        <div className="absolute left-0 right-0 top-0 h-4 -mt-2 pointer-events-none">
          {timePoints.map((tp, idx) => {
            const position = (idx / (timePoints.length - 1)) * 100;
            const month = tp.split('-')[1];
            // Only show ticks for April, July, October (1st month already has year marker)
            const showTick = ['04', '07', '10'].includes(month);
            
            return showTick ? (
              <div 
                key={tp}
                className="absolute h-3 w-px bg-gray-300 bottom-0"
                style={{ left: `${position}%` }}
              />
            ) : null;
          })}
        </div>
        
        {/* The slider input */}
        <input
          type="range"
          min="0"
          max={Math.max(0, timePoints.length - 1)}
          value={currentTimeIndex}
          onChange={handleSliderChange}
          onMouseUp={handleSliderFinish}
          onTouchEnd={handleSliderFinish}
          disabled={isLoading || timePoints.length <= 1}
          className="w-full accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          aria-valuetext={`Time point: ${currentTimePoint}`}
          aria-label="Time Point Slider"
          style={sliderStyles}
        />
        
        {/* Current position indicator */}
        <div 
          className="absolute top-0 w-px h-6 bg-blue-600 pointer-events-none -mt-2"
          style={{ 
            left: `${timePoints.length > 1 ? (currentTimeIndex / (timePoints.length - 1)) * 100 : 0}%`,
            transform: 'translateX(-50%)'
          }}
        />
      </div>
      
      {/* Additional month/year display below slider */}
      <div className="text-center text-sm text-gray-600 mt-1">
        {timePoints.length > 0 && formatTimePoint(currentTimePoint)}
      </div>
    </div>
  );
};

export default TimeControls;