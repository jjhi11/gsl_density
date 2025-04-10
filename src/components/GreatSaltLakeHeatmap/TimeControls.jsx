import React, { useCallback } from 'react';

/**
 * Component for time controls with horizontal year markers
 * No Tailwind CSS dependencies - using pure inline styles
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

  // Calculate years to display as tick marks
  const getYearTicks = () => {
    // Early exit if no data
    if (!timePoints || timePoints.length === 0) return [];
    
    const years = new Set();
    const ticks = [];
    
    // Find all unique years
    timePoints.forEach(tp => {
      const year = tp.split('-')[0];
      years.add(year);
    });
    
    // Sort years and keep a reasonable number (display every 4 years)
    const sortedYears = Array.from(years).sort();
    for (let i = 0; i < sortedYears.length; i += 4) {
      ticks.push(sortedYears[i]);
    }
    
    // Always include the last year
    if (!ticks.includes(sortedYears[sortedYears.length - 1])) {
      ticks.push(sortedYears[sortedYears.length - 1]);
    }
    
    return ticks;
  };

  const yearTicks = getYearTicks();

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

  // Styles without tailwind dependencies
  const styles = {
    container: {
      marginTop: '16px',
    },
    controlsRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      padding: '0 8px',
    },
    button: {
      padding: '8px 16px',
      borderRadius: '8px',
      fontWeight: '500',
      fontSize: '14px',
      color: 'white',
      backgroundColor: playing ? '#ef4444' : '#2563eb',
      border: 'none',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    timeDisplay: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      backgroundColor: 'white',
      padding: '4px 12px',
      borderRadius: '6px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      whiteSpace: 'nowrap',
    },
    yearTicksContainer: {
      position: 'relative',
      height: '24px',
      marginTop: '16px',
      marginBottom: '8px',
      marginLeft: '2px',
      marginRight: '2px',
    },
    yearTick: {
      position: 'absolute',
      fontSize: '12px',
      color: '#4b5563',
      transform: 'translateX(-50%)',
      textAlign: 'center',
    },
    sliderContainer: {
      padding: '0 2px',
      marginBottom: '8px',
    },
    slider: {
      WebkitAppearance: 'none',
      appearance: 'none',
      width: '100%',
      height: '8px',
      borderRadius: '9999px',
      backgroundColor: '#e5e7eb',
      outline: 'none',
      cursor: 'pointer',
    },
    sliderDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    timePointDisplay: {
      textAlign: 'center',
      fontSize: '14px',
      color: '#4b5563',
      marginTop: '8px',
    }
  };

  return (
    <div style={styles.container}>
      {/* Controls row */}
      <div style={styles.controlsRow}>
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading || timePoints.length <= 1}
          style={{
            ...styles.button,
            ...(isLoading || timePoints.length <= 1 ? styles.buttonDisabled : {})
          }}
        >
          {playing ? 'Pause' : 'Play Animation'}
        </button>

        {/* Time Point Display */}
        <div style={styles.timeDisplay}>
          {timePoints.length > 0 ? (
            `${formatTimePoint(currentTimePoint)} (${currentTimeIndex + 1}/${timePoints.length})`
          ) : (
            isLoading ? 'Loading...' : 'No time data'
          )}
        </div>
      </div>

      {/* Year Ticks */}
      <div style={styles.yearTicksContainer}>
        {yearTicks.map(year => {
          // Find the first timepoint for this year
          const index = timePoints.findIndex(tp => tp.startsWith(`${year}-`));
          if (index === -1) return null;
          
          // Calculate the position as a percentage
          const position = index / (timePoints.length - 1) * 100;
          
          return (
            <div 
              key={year} 
              style={{
                ...styles.yearTick,
                left: `${position}%`
              }}
            >
              {year}
            </div>
          );
        })}
      </div>

      {/* Slider */}
      <div style={styles.sliderContainer}>
        <input
          type="range"
          min="0"
          max={Math.max(0, timePoints.length - 1)}
          value={currentTimeIndex}
          onChange={handleSliderChange}
          onMouseUp={handleSliderFinish}
          onTouchEnd={handleSliderFinish}
          disabled={isLoading || timePoints.length <= 1}
          style={{
            ...styles.slider,
            ...(isLoading || timePoints.length <= 1 ? styles.sliderDisabled : {})
          }}
          aria-valuetext={`Time point: ${currentTimePoint}`}
          aria-label="Time Point Slider"
        />
      </div>
      
      {/* Time point display below slider */}
      <div style={styles.timePointDisplay}>
        {timePoints.length > 0 && formatTimePoint(currentTimePoint)}
      </div>
    </div>
  );
};

export default TimeControls;