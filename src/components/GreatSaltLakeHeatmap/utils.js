/**
 * Utility functions for the Great Salt Lake Heatmap
 */

/**
 * Calculate the average density from a map of station densities
 * @param {Object} densityMap - Object mapping station IDs to density values
 * @returns {number|null} - Average density or null if no valid values
 */
export const calculateAverageDensity = (densityMap) => {
    if (!densityMap || typeof densityMap !== 'object') return null;
    
    // Filter out non-numeric values
    const densities = Object.values(densityMap).filter(d => 
      typeof d === 'number' && !isNaN(d)
    );
    
    if (densities.length === 0) return null;
    
    const sum = densities.reduce((acc, val) => acc + val, 0);
    return sum / densities.length;
  };
  
  /**
   * Create a simple GeoJSON polygon representing the Great Salt Lake
   * Used as a fallback when the real GeoJSON cannot be loaded
   * @returns {Object} - GeoJSON FeatureCollection
   */
  export const createSimpleGeoJSON = () => {
    // Simple polygon approximating the Great Salt Lake shape
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-112.9, 41.4], // NW corner
              [-112.6, 41.6], // North point
              [-112.2, 41.5], // NE corner
              [-112.0, 41.2], // East point
              [-112.1, 40.8], // SE corner
              [-112.3, 40.7], // South point
              [-112.7, 40.8], // SW corner
              [-112.9, 41.1], // West point
              [-112.9, 41.4]  // Back to NW corner to close the polygon
            ]]
          }
        }
      ]
    };
  };
  
  /**
   * Format a number for display with specified precision
   * @param {number} value - Number to format
   * @param {number} precision - Number of decimal places
   * @param {string} unit - Unit to append (optional)
   * @returns {string} - Formatted number string
   */
  export const formatNumber = (value, precision = 2, unit = '') => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return `${value.toFixed(precision)}${unit}`;
  };
  
  /**
   * Check if two arrays have the same values
   * Used for memoization comparisons
   * @param {Array} arr1 - First array
   * @param {Array} arr2 - Second array
   * @returns {boolean} - True if arrays are equal
   */
  export const arraysEqual = (arr1, arr2) => {
    if (arr1 === arr2) return true;
    if (arr1 == null || arr2 == null) return false;
    if (arr1.length !== arr2.length) return false;
  
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  };