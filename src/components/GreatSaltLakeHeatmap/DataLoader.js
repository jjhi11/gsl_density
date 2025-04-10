import Papa from 'papaparse';
import proj4 from 'proj4';
import { createMockData } from './MockDataGenerator';
import { getHardcodedTemperatureData } from './TemperatureData';

// Constants
const API_ENDPOINT = 'https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app/gsl_brine_sites';
const API_HEADERS = { 'Accept': 'application/json', 'Accept-Profile': 'emp' };
const GSL_OUTLINE_ENDPOINT = 'https://ugs-geoserver-prod-flbcoqv7oa-uc.a.run.app/geoserver/gen_gis/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=gen_gis%3Agsl_outline&maxFeatures=50&outputFormat=application%2Fjson';

// Define UTM Zone 12N projection string (common for GSL area)
const utmZone12N = '+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs';
// Define WGS84 (lat/lon) projection string
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

// Define the list of allowed site IDs
const ALLOWED_SITES = ['AC3', 'AIS', 'AS2', 'FB2', 'RT4', 'RD2', 'SJ-1', 'RD1', 'LVG4'];

// Define the minimum date (January 1, 2000)
const MIN_DATE = new Date(2000, 0, 1);

/**
 * Load GeoJSON data for the lake outline
 * @returns {Promise<Object>} - Object with data and error properties
 */
export const loadGeoJsonData = async () => {
  console.log("Fetching GeoJSON from:", GSL_OUTLINE_ENDPOINT);
  
  try {
    // Try to fetch from the GeoServer WFS endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
    
    const response = await fetch(GSL_OUTLINE_ENDPOINT, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("GeoJSON fetch failed:", response.status, response.statusText, errorText);
      return { 
        data: null, 
        error: `HTTP error loading GeoJSON from URL! status: ${response.status}` 
      };
    }
    
    const gslGeoJson = await response.json();
    console.log("GeoJSON loaded successfully:", gslGeoJson.type, 
      `with ${gslGeoJson.features?.length || 0} features`);
      
    return { data: gslGeoJson, error: null };
    
  } catch (err) {
    console.error('Error loading GeoJSON from URL:', err);
    return { 
      data: null, 
      error: `Failed to load map outline: ${err.message}` 
    };
  }
};

/**
 * Process temperature data from the hardcoded source
 * @param {Array} existingTimePoints - Array of existing time points
 * @param {Object} existingTempData - Object mapping time points to temperatures
 * @returns {Object} - Object with timePoints and temperatureData
 */
const processTemperatureData = (existingTimePoints, existingTempData) => {
  try {
    console.log("Processing hardcoded temperature data...");
    
    // Get data from the hardcoded source
    const tempData = getHardcodedTemperatureData();
    
    // Initialize return objects (clone existing data)
    const updatedTimePoints = [...existingTimePoints];
    const updatedTempData = {...existingTempData};
    
    // Process each year-month
    Object.entries(tempData).forEach(([yearMonth, temp]) => {
      // Check if the time point is on or after Jan 1, 2000
      const [year, month] = yearMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      
      if (date >= MIN_DATE) {
        // Add to time points if not already present
        if (!updatedTimePoints.includes(yearMonth)) {
          updatedTimePoints.push(yearMonth);
        }
        
        // Store temperature
        updatedTempData[yearMonth] = temp;
      }
    });
    
    // Sort time points chronologically
    updatedTimePoints.sort();
    
    console.log(`Processed temperature data with ${Object.keys(updatedTempData).length} data points`);
    return { timePoints: updatedTimePoints, temperatureData: updatedTempData };
  } catch (error) {
    console.error("Error processing temperature data:", error);
    return null; // Return null on error
  }
};

/**
 * Process site data coordinates
 * @param {Object} site - Site data from API
 * @returns {Object} - Processed station with coordinates
 */
const processSiteCoordinates = (site) => {
  const stationId = site.site || `site-${site.id}`;
  let longitude = null, latitude = null, coordsSource = 'none';
  
  try {
    // Try parsing 'geom' field (GeoJSON Point)
    if (site.geom) {
      let geomObj = site.geom; 
      if (typeof site.geom === 'string') { 
        try { geomObj = JSON.parse(site.geom); } catch { geomObj = null; }
      }
      if (geomObj && geomObj.type === 'Point' && Array.isArray(geomObj.coordinates) && geomObj.coordinates.length === 2) {
        longitude = geomObj.coordinates[0]; 
        latitude = geomObj.coordinates[1]; 
        coordsSource = 'geom';
      }
    }
    
    // If 'geom' failed or missing, try UTM coordinates
    if (coordsSource === 'none' && site.utmeasting != null && site.utmnorthing != null) {
      const easting = parseFloat(site.utmeasting); 
      const northing = parseFloat(site.utmnorthing);
      if (!isNaN(easting) && !isNaN(northing)) {
        // Convert UTM Zone 12N to WGS84 Lon/Lat using proj4
        const lonLat = proj4(utmZone12N, wgs84, [easting, northing]);
        longitude = lonLat[0]; 
        latitude = lonLat[1]; 
        coordsSource = 'utm';
      }
    }
  } catch (coordError) { 
    console.warn(`Coord error site ${stationId}:`, coordError); 
  }
  
  // Use default coordinates if both methods fail
  if (coordsSource === 'none') { 
    console.warn(`Using default coords for site ${stationId}`); 
    longitude = -112.5; 
    latitude = 41.0; 
  }
  
  return { 
    id: stationId, 
    name: site.site || `Site ${site.id}`, 
    longitude, 
    latitude, 
    coordsSource 
  };
};

/**
 * Generate mock density data for stations based on temperature
 * @param {Array} stations - Array of station objects
 * @param {Array} timePoints - Array of time points (YYYY-MM)
 * @param {Object} temperatureData - Object mapping time points to temperatures
 * @returns {Object} - Density data in format { 'YYYY-MM': { stationId: density } }
 */
const generateMockDensityForStations = (stations, timePoints, temperatureData) => {
  console.log("Generating mock density data for real stations...");
  const densityData = {};
  
  // Process each time point
  timePoints.forEach(yearMonth => {
    densityData[yearMonth] = {};
    const [year, month] = yearMonth.split('-').map(Number);
    const temp = temperatureData[yearMonth];
    
    // Process each station
    stations.forEach((station, index) => {
      // Base density with factors:
      // 1. Temperature influence (higher temp = higher density due to evaporation)
      // 2. Year trend (slight increase over time)
      // 3. Seasonal variation
      // 4. Station location variation (stations have consistent relative differences)
      // 5. Random variation
      
      // Temperature factor (normalized to range)
      const tempFactor = temp ? (temp - 30) / 50 * 0.03 : 0;
      
      // Year factor (gradual increase)
      const yearFactor = (year - 2000) * 0.0005;
      
      // Seasonal factor (higher in summer due to evaporation)
      const seasonalFactor = Math.sin((month - 1) / 12 * 2 * Math.PI) * 0.01;
      
      // Station-specific factor (some stations consistently have higher density)
      const stationFactor = (index / stations.length) * 0.05;
      
      // Random variation
      const randomFactor = (Math.random() - 0.5) * 0.015;
      
      // Combine all factors
      const baseDensity = 1.10 + tempFactor + yearFactor + seasonalFactor + stationFactor + randomFactor;
      
      // Clamp to realistic range
      densityData[yearMonth][station.id] = Math.max(1.02, Math.min(1.28, baseDensity));
    });
  });
  
  return densityData;
};

/**
 * Extract LABminusDENg/cm3 or fallback to other density properties
 * @param {Object} reading - Reading object from API
 * @returns {number|null} - Density value or null if not available
 */
const extractDensityValue = (reading) => {
  // Try all possible variations of the property name with newline
  const possibleNames = [
    'LABminusDENg/cm3',
    'LABminusDEN\ng/cm3',
    'LABminusDEN\\ng/cm3'
  ];
  
  // Try each possible name
  for (const propName of possibleNames) {
    // Look for exact match
    if (reading[propName] !== undefined && reading[propName] !== null) {
      const density = parseFloat(reading[propName]);
      if (!isNaN(density)) {
        return density;
      }
    }
  }
  
  // Try finding a key that contains "LABminusDEN"
  const densityKey = Object.keys(reading).find(key => key.includes("LABminusDEN"));
  if (densityKey && reading[densityKey] !== undefined && reading[densityKey] !== null) {
    const density = parseFloat(reading[densityKey]);
    if (!isNaN(density)) {
      return density;
    }
  }
  
  // Fallback to regular density
  if (reading.density !== undefined && reading.density !== null) {
    const density = parseFloat(reading.density);
    if (!isNaN(density)) {
      return density;
    }
  }
  
  // Try to calculate from salinity
  if (reading.salinity !== undefined && reading.salinity !== null) {
    const salinity = parseFloat(reading.salinity);
    if (!isNaN(salinity)) {
      return 1 + (salinity * 0.0008); // Simplified approximation
    }
  }
  
  // No valid density data found
  return null;
};

/**
 * Check if a date is on or after January 1, 2000
 * @param {string} dateStr - Date string
 * @returns {boolean} - True if date is valid and on/after Jan 1, 2000
 */
const isDateOnOrAfter2000 = (dateStr) => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    return date >= MIN_DATE;
  } catch (e) {
    return false;
  }
};

/**
 * Load site and temperature data
 * @returns {Promise<Object>} - Object with stations, timePoints, densityData, temperatureData, densityRange
 */
export const loadSiteAndTempData = async () => {
  console.log("Fetching data from PostgREST API and temperature file...");
  
  try {
    // Initialize result containers
    let sitesJson = [];
    let processedStations = [];
    let tempLookup = {};
    let densityLookup = {};
    let timePointsSet = new Set();
    let hasRealReadings = false;
    let errorMessage = null;
    let apiSuccessful = false;
    
    // Try to fetch site data from the API
    try {
      const response = await fetch(API_ENDPOINT, { 
        method: 'GET', 
        headers: API_HEADERS,
        signal: AbortSignal.timeout(5000) // 5-second timeout
      });
      
      console.log("API Response Status:", response.status, response.statusText);
      
      if (response.ok) {
        sitesJson = await response.json();
        console.log("Sites data received:", sitesJson.length);
        
        // Filter sites to only include the allowed ones
        const filteredSites = sitesJson.filter(site => {
          const siteId = site.site || `site-${site.id}`;
          return ALLOWED_SITES.includes(siteId);
        });
        
        console.log(`Filtered sites from ${sitesJson.length} to ${filteredSites.length} (keeping only: ${ALLOWED_SITES.join(', ')})`);
        
        // Replace sitesJson with the filtered sites
        sitesJson = filteredSites;
        
        // Log a sample site to inspect structure
        if (sitesJson.length > 0 && sitesJson[0].readings && sitesJson[0].readings.length > 0) {
          console.log("Sample reading fields:", Object.keys(sitesJson[0].readings[0]));
        }
        
        apiSuccessful = true;
        
        // Process sites' coordinates
        processedStations = sitesJson.map(processSiteCoordinates)
          .filter(st => st.longitude != null && st.latitude != null);
        
        console.log(`Processed ${processedStations.length} stations with coordinates.`);
        
        // Initialize density reading counters
        let densityReadingsCount = 0;
        let readingsWithDensity = [];
        
        // Process readings from sites
        if (processedStations.length > 0) {
          sitesJson.forEach(site => {
            const stationId = site.site || `site-${site.id}`;
            // Only process readings for stations with coordinates
            const stationExists = processedStations.some(ps => ps.id === stationId);
            if (!stationExists || !site.readings || !Array.isArray(site.readings)) return;

            site.readings
              // Only include readings from Jan 1, 2000 or later
              .filter(reading => reading.date && isDateOnOrAfter2000(reading.date))
              .forEach(reading => {
                if (!reading.date) return;
                
                try {
                  // Parse date and format as 'YYYY-MM'
                  const dateObj = new Date(reading.date); 
                  if (isNaN(dateObj.getTime())) return;
                  
                  const year = dateObj.getFullYear(); 
                  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0'); 
                  const yearMonth = `${year}-${month}`;
                  timePointsSet.add(yearMonth);

                  // Process temperature
                  if (reading.temperature != null) {
                    if (!tempLookup[yearMonth]) tempLookup[yearMonth] = [];
                    tempLookup[yearMonth].push(reading.temperature);
                  }

                  // Extract density from LABminusDENg/cm3 or other sources
                  const densityValue = extractDensityValue(reading);
                  
                  if (densityValue !== null) {
                    densityReadingsCount++;
                    
                    // Save the date and value for logging (limit to 10 samples)
                    if (readingsWithDensity.length < 10) {
                      readingsWithDensity.push({ 
                        date: reading.date, 
                        station: stationId, 
                        density: densityValue 
                      });
                    }
                    
                    hasRealReadings = true; // Mark that we found real data
                    if (!densityLookup[yearMonth]) densityLookup[yearMonth] = {};
                    densityLookup[yearMonth][stationId] = densityValue;
                  }
                } catch (parseError) { 
                  console.warn(`Error parsing reading for ${stationId}:`, parseError); 
                }
              });
          });

          // Log density reading results
          console.log(`Found ${densityReadingsCount} readings with density values`);
          if (readingsWithDensity.length > 0) {
            console.log("Sample density readings:", readingsWithDensity);
          }

          // Average monthly temperatures
          const averagedTempData = {};
          for (const yearMonth in tempLookup) {
            const temps = tempLookup[yearMonth];
            if (temps.length > 0) { 
              averagedTempData[yearMonth] = temps.reduce((a, b) => a + b, 0) / temps.length; 
            }
          }
          tempLookup = averagedTempData;
          
          console.log("Has real density readings:", hasRealReadings);
        }
      } else {
        errorMessage = `API fetch failed: ${response.status} ${response.statusText}`;
        console.warn(errorMessage);
      }
    } catch (apiError) {
      errorMessage = `Error fetching from API: ${apiError.message}`;
      console.error(errorMessage, apiError);
    }
    
    // Process hardcoded temperature data
    try {
      const tempResult = processTemperatureData(
        Array.from(timePointsSet), 
        tempLookup
      );
      
      if (tempResult) {
        timePointsSet = new Set(tempResult.timePoints);
        tempLookup = tempResult.temperatureData;
      }
    } catch (tempError) {
      console.warn("Error processing temperature data:", tempError);
    }
    
    // Filter all time points to only include dates from Jan 1, 2000 onward
    const allTimePoints = Array.from(timePointsSet)
      .filter(yearMonth => {
        const [year, month] = yearMonth.split('-').map(Number);
        return year >= 2000; // Year must be 2000 or later
      })
      .sort();
    
    console.log(`Filtered time points to include only dates from Jan 1, 2000 onward. Result: ${allTimePoints.length} time points`);
    
    // Generate density data for all stations and all time points
    // This will ensure we have complete data, even if the API doesn't provide readings
    if (processedStations.length > 0 && allTimePoints.length > 0) {
      // Determine if we have real density readings
      const hasRealDensityData = Object.values(densityLookup).some(
        monthData => Object.keys(monthData).length > 0
      );
      
      console.log(`Has real density data: ${hasRealDensityData}, timepoints with data: ${Object.keys(densityLookup).length}`);
      
      if (!hasRealDensityData) {
        console.log("No real density data found. Generating synthetic data.");
        densityLookup = generateMockDensityForStations(processedStations, allTimePoints, tempLookup);
      } else {
        console.log("Using real density data where available, supplementing with synthetic data.");
        // Keep real data but fill in missing values with synthetic data
        const syntheticData = generateMockDensityForStations(processedStations, allTimePoints, tempLookup);
        
        // Merge real data with synthetic data (real data takes precedence)
        allTimePoints.forEach(yearMonth => {
          if (!densityLookup[yearMonth]) {
            densityLookup[yearMonth] = {};
          }
          
          processedStations.forEach(station => {
            if (densityLookup[yearMonth][station.id] === undefined && 
                syntheticData[yearMonth] && 
                syntheticData[yearMonth][station.id] !== undefined) {
              densityLookup[yearMonth][station.id] = syntheticData[yearMonth][station.id];
            }
          });
        });
      }
    }
    
    // Determine if we need to use mock data - check if we still have insufficient data
    let usingMockData = false;
    
    // Special case: if we have no filtered stations, create mock stations with the same IDs
    if (processedStations.length === 0) {
      console.warn("No matching stations found for the specified site IDs. Creating mock stations with those IDs.");
      usingMockData = true;
      
      // Create mock stations with the specified IDs
      processedStations = ALLOWED_SITES.map((id, index) => {
        // Distribute stations around the lake
        const angle = (index / ALLOWED_SITES.length) * 2 * Math.PI;
        const radius = 0.2;
        const centerLon = -112.5;
        const centerLat = 41.0;
        
        return {
          id,
          name: `Site ${id}`,
          longitude: centerLon + radius * Math.cos(angle),
          latitude: centerLat + radius * Math.sin(angle),
          coordsSource: 'mock'
        };
      });
      
      // Generate mock data for these stations
      if (allTimePoints.length < 10) {
        // If we don't have enough time points either, use generated time points
        // but ensure they start from Jan 2000
        const mockTimePoints = [];
        const startYear = 2000;
        const endYear = 2025;
        
        for (let year = startYear; year <= endYear; year++) {
          for (let month = 1; month <= 12; month++) {
            // Skip future months in current year
            if (year === endYear && month > new Date().getMonth() + 1) continue;
            
            const monthStr = month.toString().padStart(2, '0');
            mockTimePoints.push(`${year}-${monthStr}`);
          }
        }
        
        allTimePoints.push(...mockTimePoints.filter(tp => !allTimePoints.includes(tp)));
        allTimePoints.sort();
        
        // Generate temps for the mock time points
        mockTimePoints.forEach(yearMonth => {
          if (!tempLookup[yearMonth]) {
            const [year, month] = yearMonth.split('-').map(Number);
            // Base temperature with seasonal variation
            const baseTemp = 50 + Math.sin((month - 1) / 12 * 2 * Math.PI) * 25;
            // Add yearly warming trend and random variation
            const yearEffect = (year - startYear) * 0.2;
            tempLookup[yearMonth] = baseTemp + yearEffect + (Math.random() - 0.5) * 5;
          }
        });
      }
      
      // Generate density data for the mock stations
      densityLookup = generateMockDensityForStations(processedStations, allTimePoints, tempLookup);
    }
    // Normal case: we have too few stations or time points
    else if (processedStations.length < 3 || allTimePoints.length < 10) {
      console.warn("Insufficient real data despite attempts. Using generated data instead.");
      usingMockData = true;
      
      // Generate time points from Jan 2000 onward
      const mockTimePoints = [];
      const startYear = 2000;
      const endYear = 2025;
      
      for (let year = startYear; year <= endYear; year++) {
        for (let month = 1; month <= 12; month++) {
          // Skip future months in current year
          if (year === endYear && month > new Date().getMonth() + 1) continue;
          
          const monthStr = month.toString().padStart(2, '0');
          mockTimePoints.push(`${year}-${monthStr}`);
        }
      }
      
      // If the API was completely unsuccessful, include that in the error message
      if (!apiSuccessful) {
        errorMessage = errorMessage || "API data unavailable. Using simulated data.";
      }
      
      // Generate mock data for the stations we have
      const mockDensityData = generateMockDensityForStations(processedStations, mockTimePoints, tempLookup);
      
      return {
        stations: processedStations,
        timePoints: mockTimePoints,
        densityData: mockDensityData,
        temperatureData: tempLookup,
        densityRange: [1.05, 1.20],
        usingMockData: true,
        error: errorMessage
      };
    }
    
    // Use our final processed data
    const finalTimePoints = allTimePoints.sort();
    
    // Handle edge case with no time points
    if (finalTimePoints.length === 0) {
      console.warn("No time points available. Creating default time points from 2000 onward.");
      // Add monthly time points from Jan 2000 to current month
      const startYear = 2000;
      const endYear = new Date().getFullYear();
      const endMonth = new Date().getMonth() + 1;
      
      for (let year = startYear; year <= endYear; year++) {
        const monthLimit = (year === endYear) ? endMonth : 12;
        for (let month = 1; month <= monthLimit; month++) {
          const monthStr = month.toString().padStart(2, '0');
          finalTimePoints.push(`${year}-${monthStr}`);
          
          // Initialize empty data structures
          if (!densityLookup[`${year}-${monthStr}`]) {
            densityLookup[`${year}-${monthStr}`] = {};
          }
          if (!tempLookup[`${year}-${monthStr}`]) {
            // Create synthetic temperature
            const baseTemp = 50 + Math.sin((month - 1) / 12 * 2 * Math.PI) * 25;
            const yearEffect = (year - startYear) * 0.2;
            tempLookup[`${year}-${monthStr}`] = baseTemp + yearEffect + (Math.random() - 0.5) * 5;
          }
        }
      }
      
      // Generate density data for all stations and time points
      densityLookup = generateMockDensityForStations(processedStations, finalTimePoints, tempLookup);
    }
    
    // Calculate density range
    let densityRange = [1.0, 1.25]; // Default
    
    const allDensities = [];
    Object.values(densityLookup).forEach(monthData => {
      Object.values(monthData).forEach(density => {
        if (typeof density === 'number' && !isNaN(density)) allDensities.push(density);
      });
    });
    
    if (allDensities.length > 0) {
      const minD = Math.min(...allDensities); 
      const maxD = Math.max(...allDensities);
      densityRange = [
        Math.max(1.0, minD * 0.99), 
        Math.min(1.35, maxD * 1.01)
      ];
    }
    
    return {
      stations: processedStations,
      timePoints: finalTimePoints,
      densityData: densityLookup,
      temperatureData: tempLookup,
      densityRange,
      usingMockData,
      error: errorMessage
    };
    
  } catch (err) {
    console.error('Error loading or processing data:', err);
    
    // Use mock data as fallback, but ensure it's from Jan 2000 onward
    console.log("Using mock data as fallback after error");
    
    // Create mock stations with the specified IDs
    const mockStations = ALLOWED_SITES.map((id, index) => {
      // Distribute stations around the lake
      const angle = (index / ALLOWED_SITES.length) * 2 * Math.PI;
      const radius = 0.2;
      const centerLon = -112.5;
      const centerLat = 41.0;
      
      return {
        id,
        name: `Site ${id}`,
        longitude: centerLon + radius * Math.cos(angle),
        latitude: centerLat + radius * Math.sin(angle),
        coordsSource: 'mock'
      };
    });
    
    // Generate time points from Jan 2000 onward
    const mockTimePoints = [];
    const startYear = 2000;
    const endYear = 2025;
    const currentMonth = new Date().getMonth() + 1;
    
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        // Skip future months in current year
        if (year === endYear && month > currentMonth) continue;
        
        const monthStr = month.toString().padStart(2, '0');
        mockTimePoints.push(`${year}-${monthStr}`);
      }
    }
    
    // Generate temperature data
    const mockTempData = {};
    mockTimePoints.forEach(yearMonth => {
      const [year, month] = yearMonth.split('-').map(Number);
      // Base temperature with seasonal variation
      const baseTemp = 50 + Math.sin((month - 1) / 12 * 2 * Math.PI) * 25;
      // Add yearly warming trend and random variation
      const yearEffect = (year - startYear) * 0.2;
      mockTempData[yearMonth] = baseTemp + yearEffect + (Math.random() - 0.5) * 5;
    });
    
    // Generate density data
    const mockDensityData = generateMockDensityForStations(mockStations, mockTimePoints, mockTempData);
    
    return {
      stations: mockStations,
      timePoints: mockTimePoints,
      densityData: mockDensityData,
      temperatureData: mockTempData,
      densityRange: [1.05, 1.20],
      usingMockData: true,
      error: `Failed to load data: ${err.message}`
    };
  }
};