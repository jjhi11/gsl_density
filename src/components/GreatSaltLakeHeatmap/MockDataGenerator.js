/**
 * Generate mock data for the Great Salt Lake Heatmap
 * Used when API data is unavailable or insufficient
 */
export const createMockData = () => {
    console.log("Creating mock GSL data...");
    
    // Create mock stations around the Great Salt Lake area
    const mockStations = [
      { id: 'station-1', name: 'North Arm', longitude: -112.9, latitude: 41.4, coordsSource: 'mock' },
      { id: 'station-2', name: 'Promontory Point', longitude: -112.4, latitude: 41.2, coordsSource: 'mock' },
      { id: 'station-3', name: 'Fremont Island', longitude: -112.3, latitude: 41.1, coordsSource: 'mock' },
      { id: 'station-4', name: 'Antelope Island', longitude: -112.2, latitude: 41.0, coordsSource: 'mock' },
      { id: 'station-5', name: 'Saltair', longitude: -112.1, latitude: 40.8, coordsSource: 'mock' },
      { id: 'station-6', name: 'Farmington Bay', longitude: -112.0, latitude: 41.0, coordsSource: 'mock' },
      { id: 'station-7', name: 'Ogden Bay', longitude: -112.2, latitude: 41.2, coordsSource: 'mock' },
      { id: 'station-8', name: 'Bear River Bay', longitude: -112.3, latitude: 41.3, coordsSource: 'mock' },
      { id: 'station-9', name: 'Carrington Island', longitude: -112.6, latitude: 41.0, coordsSource: 'mock' },
      { id: 'station-10', name: 'Stansbury Island', longitude: -112.5, latitude: 40.8, coordsSource: 'mock' },
    ];
    
    // Create mock monthly time points for the last 5 years
    const timePoints = [];
    const startYear = 2020;
    const endYear = 2025;
    
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        // Skip future months in current year
        if (year === endYear && month > 3) continue;
        
        const monthStr = month.toString().padStart(2, '0');
        timePoints.push(`${year}-${monthStr}`);
      }
    }
    
    // Create mock temperature data with realistic seasonal variations
    const temperatureData = {};
    timePoints.forEach(yearMonth => {
      const [year, month] = yearMonth.split('-').map(Number);
      
      // Base temperature with seasonal variation
      // Higher in summer, lower in winter
      const baseTemp = 50 + Math.sin((month - 1) / 12 * 2 * Math.PI) * 25;
      
      // Add yearly warming trend and random variation
      const yearEffect = (year - startYear) * 0.2;
      temperatureData[yearMonth] = baseTemp + yearEffect + (Math.random() - 0.5) * 5;
    });
    
    // Create mock density data with seasonal and spatial variations
    const densityData = {};
    timePoints.forEach(yearMonth => {
      const [year, month] = yearMonth.split('-').map(Number);
      densityData[yearMonth] = {};
      
      mockStations.forEach((station, index) => {
        // Base density with factors:
        // 1. Yearly trend (slight increase over time)
        // 2. Seasonal variation (higher in summer due to evaporation)
        // 3. Random variation
        // 4. Spatial variation (gradual increase across stations)
        
        let baseDensity = 1.10 + 
                          (year - startYear) * 0.001 + // Yearly trend
                          Math.sin((month - 1) / 12 * 2 * Math.PI) * 0.01 + // Seasonal
                          (Math.random() - 0.5) * 0.02 + // Random
                          (index / mockStations.length) * 0.05; // Spatial
        
        // Clamp values to realistic range
        densityData[yearMonth][station.id] = Math.max(1.0, Math.min(1.3, baseDensity));
      });
    });
    
    return {
      stations: mockStations,
      timePoints: timePoints,
      temperatureData: temperatureData,
      densityData: densityData,
      densityRange: [1.05, 1.20]
    };
  };
  
  /**
   * Create a mock reading for a specific date and station
   * @param {string} stationId - Station ID
   * @param {Date} date - Date for the reading
   * @returns {Object} - Mock reading
   */
  export const createMockReading = (stationId, date) => {
    const month = date.getMonth(); // 0-11
    const yearsSince2020 = date.getFullYear() - 2020;
    
    // Base temperature with seasonal variation
    const baseTemp = 50 + Math.sin(month / 12 * 2 * Math.PI) * 25;
    
    // Temperature with yearly trend and random variation
    const temperature = baseTemp + yearsSince2020 * 0.2 + (Math.random() - 0.5) * 5;
    
    // Base density with seasonal variation
    const baseDensity = 1.10 + 
                      yearsSince2020 * 0.001 + // Yearly trend
                      Math.sin(month / 12 * 2 * Math.PI) * 0.01 + // Seasonal
                      (Math.random() - 0.5) * 0.02; // Random
    
    // Density clamped to realistic range
    const density = Math.max(1.0, Math.min(1.3, baseDensity));
    
    // Calculate approximate salinity from density
    const salinity = (density - 1) / 0.0008;
    
    return {
      date: date.toISOString(),
      temperature,
      density,
      salinity,
      stationId
    };
  };