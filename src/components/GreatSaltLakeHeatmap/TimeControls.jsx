import React, { useCallback } from 'react';

/**
 * Component for time controls (play/pause button and slider)
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
            `${currentTimePoint} (${currentTimeIndex + 1}/${timePoints.length})`
          ) : (
            isLoading ? 'Loading...' : 'No time data'
          )}
        </div>
      </div>

      {/* Time Slider */}
      <input
        type="range"
        min="0"
        max={Math.max(0, timePoints.length - 1)}
        value={currentTimeIndex}
        onChange={handleSliderChange}
        onMouseUp={handleSliderFinish}
        onTouchEnd={handleSliderFinish}
        disabled={isLoading || timePoints.length <= 1}
        className="w-full mt-4 accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 px-2"
        aria-valuetext={`Time point: ${currentTimePoint}`}
        aria-label="Time Point Slider"
      />
    </div>
  );
};

export default TimeControls;