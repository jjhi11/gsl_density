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
      // Add to time points if not already present
      if (!updatedTimePoints.includes(yearMonth)) {
        updatedTimePoints.push(yearMonth);
      }
      
      // Store temperature
      updatedTempData[yearMonth] = temp;
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
        apiSuccessful = true;
        
        // Process sites' coordinates
        processedStations = sitesJson.map(processSiteCoordinates)
          .filter(st => st.longitude != null && st.latitude != null);
        
        console.log(`Processed ${processedStations.length} stations with coordinates.`);
        
        // Process readings from sites
        if (processedStations.length > 0) {
          sitesJson.forEach(site => {
            const stationId = site.site || `site-${site.id}`;
            // Only process readings for stations with coordinates
            const stationExists = processedStations.some(ps => ps.id === stationId);
            if (!stationExists || !site.readings || !Array.isArray(site.readings)) return;

            site.readings.forEach(reading => {
              if (!reading.date) return;
              hasRealReadings = true;
              
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

                // Process density or calculate from salinity
                let densityValue = null;
                if (reading.density != null) { 
                  densityValue = reading.density; 
                } else if (reading.salinity != null) { 
                  densityValue = 1 + (reading.salinity * 0.0008); // Simplified approximation
                }

                if (densityValue !== null) {
                  if (!densityLookup[yearMonth]) densityLookup[yearMonth] = {};
                  densityLookup[yearMonth][stationId] = densityValue;
                }
              } catch (parseError) { 
                console.warn(`Error parsing reading for ${stationId}:`, parseError); 
              }
            });
          });

          // Average monthly temperatures
          const averagedTempData = {};
          for (const yearMonth in tempLookup) {
            const temps = tempLookup[yearMonth];
            if (temps.length > 0) { 
              averagedTempData[yearMonth] = temps.reduce((a, b) => a + b, 0) / temps.length; 
            }
          }
          tempLookup = averagedTempData;
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
    
    // Determine if we need to use mock data - check if we have enough real data
    let usingMockData = false;
    if (!hasRealReadings || processedStations.length < 3) {
      console.warn("Insufficient real data. Using mock data instead.");
      usingMockData = true;
      
      const mockData = createMockData();
      processedStations = mockData.stations;
      timePointsSet = new Set(mockData.timePoints);
      tempLookup = mockData.temperatureData;
      densityLookup = mockData.densityData;
      
      // If the API was completely unsuccessful, include that in the error message
      if (!apiSuccessful) {
        errorMessage = errorMessage || "API data unavailable. Using simulated data.";
      }
      
      return {
        stations: mockData.stations,
        timePoints: mockData.timePoints,
        densityData: mockData.densityData,
        temperatureData: mockData.temperatureData,
        densityRange: mockData.densityRange,
        usingMockData: true,
        error: errorMessage
      };
    }
    
    // Finalize data
    const allTimePoints = Array.from(timePointsSet).sort();
    
    // Handle edge case with no time points
    if (allTimePoints.length === 0) {
      console.warn("No time points available. Creating default.");
      const year = new Date().getFullYear(); 
      allTimePoints.push(`${year}-01`);
      if (!densityLookup[`${year}-01`]) densityLookup[`${year}-01`] = {};
      if (!tempLookup[`${year}-01`]) tempLookup[`${year}-01`] = undefined;
    }
    
    // Calculate density range
    let densityRange = [1.0, 1.25]; // Default
    
    if (!usingMockData) {
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
    }
    
    return {
      stations: processedStations,
      timePoints: allTimePoints,
      densityData: densityLookup,
      temperatureData: tempLookup,
      densityRange,
      usingMockData,
      error: errorMessage
    };
    
  } catch (err) {
    console.error('Error loading or processing data:', err);
    
    // Use mock data as fallback
    console.log("Using mock data as fallback after error");
    const mockData = createMockData();
    
    return {
      ...mockData,
      usingMockData: true,
      error: `Failed to load data: ${err.message}`
    };
  }
};