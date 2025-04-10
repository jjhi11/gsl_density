// DataLoader.js
import Papa from 'papaparse';
import proj4 from 'proj4';
// Removed MockDataGenerator import as we'll define generation here or assume API provides enough
// import { createMockData } from './MockDataGenerator';
import { getHardcodedTemperatureData } from './TemperatureData';

// Constants
const API_ENDPOINT = 'https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app/gsl_brine_sites';
const API_HEADERS = { 'Accept': 'application/json', 'Accept-Profile': 'emp' };
const GSL_OUTLINE_ENDPOINT = 'https://ugs-geoserver-prod-flbcoqv7oa-uc.a.run.app/geoserver/gen_gis/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=gen_gis%3Agsl_outline_split&maxFeatures=50&outputFormat=application%2Fjson';

// Define UTM Zone 12N projection string (common for GSL area)
const utmZone12N = '+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs';
// Define WGS84 (lat/lon) projection string
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

// Define the list of allowed site IDs
const ALLOWED_SITES = ['AC3', 'AIS', 'AS2', 'FB2', 'RT4', 'RD2', 'SJ-1', 'RD1', 'LVG4'];

// Define the minimum date (January 1, 2000)
const MIN_DATE = new Date(2000, 0, 1);

// Helper: Load GeoJSON
export const loadGeoJsonData = async () => {
  console.log("Fetching GeoJSON from:", GSL_OUTLINE_ENDPOINT);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(GSL_OUTLINE_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
        const errorText = await response.text();
        console.error("GeoJSON fetch failed:", response.status, response.statusText, errorText);
        return { data: null, error: `HTTP error loading GeoJSON from URL! status: ${response.status}` };
    }
    const gslGeoJson = await response.json();
    console.log("GeoJSON loaded successfully:", gslGeoJson.type, `with ${gslGeoJson.features?.length || 0} features`);
    return { data: gslGeoJson, error: null };
  } catch (err) {
    console.error('Error loading GeoJSON from URL:', err);
    return { data: null, error: `Failed to load map outline: ${err.message}` };
  }
};


// Helper: Process temperature data
const processTemperatureData = (existingTimePoints, existingTempData) => {
   try {
     console.log("Processing hardcoded temperature data...");
     const tempData = getHardcodedTemperatureData();
     const updatedTimePoints = [...existingTimePoints];
     const updatedTempData = {...existingTempData};
     Object.entries(tempData).forEach(([yearMonth, temp]) => {
       const [year, month] = yearMonth.split('-').map(Number);
       const date = new Date(year, month - 1, 1);
       if (date >= MIN_DATE) {
         if (!updatedTimePoints.includes(yearMonth)) {
           updatedTimePoints.push(yearMonth);
         }
         updatedTempData[yearMonth] = temp;
       }
     });
     updatedTimePoints.sort();
     console.log(`Processed temperature data with ${Object.keys(updatedTempData).length} data points`);
     return { timePoints: updatedTimePoints, temperatureData: updatedTempData };
   } catch (error) {
     console.error("Error processing temperature data:", error);
     return null;
   }
};

// Helper: Process coordinates
const processSiteCoordinates = (site) => {
  const stationId = site.site || `site-${site.id}`;
  let longitude = null, latitude = null, coordsSource = 'none';
  try {
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
    if (coordsSource === 'none' && site.utmeasting != null && site.utmnorthing != null) {
        const easting = parseFloat(site.utmeasting);
        const northing = parseFloat(site.utmnorthing);
        if (!isNaN(easting) && !isNaN(northing)) {
           const lonLat = proj4(utmZone12N, wgs84, [easting, northing]);
           longitude = lonLat[0];
           latitude = lonLat[1];
           coordsSource = 'utm';
        }
    }
  } catch (coordError) { console.warn(`Coord error site ${stationId}:`, coordError); }
  if (coordsSource === 'none') {
     console.warn(`Using default coords for site ${stationId}`);
     longitude = -112.5;
     latitude = 41.0;
  }
  return { id: stationId, name: site.site || `Site ${site.id}`, longitude, latitude, coordsSource };
};

// --- Helper function to extract density ---
const extractDensityValue = (reading) => {
  const possibleNames = ['LABminusDENg/cm3', 'LABminusDEN\ng/cm3', 'LABminusDEN\\ng/cm3'];
  for (const propName of possibleNames) {
    if (reading[propName] !== undefined && reading[propName] !== null) {
      const density = parseFloat(reading[propName]);
      if (!isNaN(density)) return density;
    }
  }
  const densityKey = Object.keys(reading).find(key => key.includes("LABminusDEN"));
  if (densityKey && reading[densityKey] !== undefined && reading[densityKey] !== null) {
     const density = parseFloat(reading[densityKey]);
     if (!isNaN(density)) return density;
  }
  if (reading.density !== undefined && reading.density !== null) {
    const density = parseFloat(reading.density);
    if (!isNaN(density)) return density;
  }
  if (reading.salinity !== undefined && reading.salinity !== null) {
     const salinity = parseFloat(reading.salinity);
     if (!isNaN(salinity)) return 1 + (salinity * 0.0008);
  }
  return null;
};


// --- NEW: Helper function to extract salinity ---
const extractSalinityValue = (reading) => {
   const salinityEOSKey = Object.keys(reading).find(key => key.toLowerCase() === 'salinity eos (g/l)');
   if (salinityEOSKey && reading[salinityEOSKey] !== null && reading[salinityEOSKey] !== undefined) {
      const salinity = parseFloat(reading[salinityEOSKey]);
      if (!isNaN(salinity)) return salinity;
   }
  if (reading.salinity !== undefined && reading.salinity !== null) {
    const salinity = parseFloat(reading.salinity);
    if (!isNaN(salinity)) return salinity; // Assuming this is ppt? May need conversion to g/L
  }
  return null;
};

// Helper: Check date
const isDateOnOrAfter2000 = (dateStr) => {
    try {
       const date = new Date(dateStr);
       if (isNaN(date.getTime())) return false;
       return date >= MIN_DATE;
    } catch (e) { return false; }
};

// --- Helper function to generate mock density ---
const generateMockDensityForStations = (stations, timePoints, temperatureData) => {
   console.log("Generating mock density data...");
   const densityData = {};
   timePoints.forEach(yearMonth => {
      densityData[yearMonth] = {};
      const [year, month] = yearMonth.split('-').map(Number);
      const temp = temperatureData[yearMonth];
      stations.forEach((station, index) => {
         const tempFactor = temp ? (temp - 30) / 50 * 0.03 : 0;
         const yearFactor = (year - 2000) * 0.0005;
         const seasonalFactor = Math.sin((month - 1) / 12 * 2 * Math.PI) * 0.01;
         const stationFactor = (index / stations.length) * 0.05;
         const randomFactor = (Math.random() - 0.5) * 0.015;
         const baseDensity = 1.10 + tempFactor + yearFactor + seasonalFactor + stationFactor + randomFactor;
         densityData[yearMonth][station.id] = Math.max(1.02, Math.min(1.28, baseDensity));
      });
   });
   return densityData;
};


// --- NEW: Helper function to generate mock salinity ---
const generateMockSalinityForStations = (stations, timePoints, temperatureData) => {
  console.log("Generating mock salinity data...");
  const salinityData = {};
  const baseSalinity = 150; // Base g/L - adjust if needed

  timePoints.forEach(yearMonth => {
    salinityData[yearMonth] = {};
    const [year, month] = yearMonth.split('-').map(Number);
    const temp = temperatureData[yearMonth];

    stations.forEach((station, index) => {
      const tempFactor = temp ? (temp - 50) / 50 * -10 : 0; // Example inverse relation
      const yearFactor = (year - 2000) * 0.1;
      const seasonalFactor = Math.sin((month - 1) / 12 * 2 * Math.PI) * -15; // Lower in summer
      const stationFactor = (index / stations.length) * 30;
      const randomFactor = (Math.random() - 0.5) * 20;
      let salinity = baseSalinity + tempFactor + yearFactor + seasonalFactor + stationFactor + randomFactor;
      salinityData[yearMonth][station.id] = Math.max(30, Math.min(280, salinity)); // g/L range
    });
  });
  return salinityData;
};


// --- Main data loading function ---
export const loadSiteAndTempData = async () => {
  console.log("Fetching site data...");
  try {
    let sitesJson = [];
    let processedStations = [];
    let tempLookup = {};
    let densityLookup = {};
    let salinityLookup = {}; // ++ Add salinity lookup ++
    let timePointsSet = new Set();
    let hasRealDensity = false;
    let hasRealSalinity = false; // ++ Track real salinity ++
    let errorMessage = null;
    let apiSuccessful = false;

    // Fetch API data
    try {
      const response = await fetch(API_ENDPOINT, { method: 'GET', headers: API_HEADERS, signal: AbortSignal.timeout(5000) });
      console.log("API Response Status:", response.status, response.statusText);
      if (response.ok) {
         sitesJson = await response.json();
         apiSuccessful = true;
         const filteredSites = sitesJson.filter(site => ALLOWED_SITES.includes(site.site || `site-${site.id}`));
         sitesJson = filteredSites; // Use filtered sites
         processedStations = sitesJson.map(processSiteCoordinates).filter(st => st.longitude != null && st.latitude != null);

         if (processedStations.length > 0) {
            sitesJson.forEach(site => {
              const stationId = site.site || `site-${site.id}`;
              if (!processedStations.some(ps => ps.id === stationId) || !site.readings || !Array.isArray(site.readings)) return;

              site.readings
                .filter(reading => reading.date && isDateOnOrAfter2000(reading.date))
                .forEach(reading => {
                  try {
                    const dateObj = new Date(reading.date);
                    if (isNaN(dateObj.getTime())) return;
                    const year = dateObj.getFullYear();
                    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                    const yearMonth = `${year}-${month}`;
                    timePointsSet.add(yearMonth);

                    // Temperature (keep as before)
                    if (reading.temperature != null) {
                        if (!tempLookup[yearMonth]) tempLookup[yearMonth] = [];
                        tempLookup[yearMonth].push(reading.temperature);
                    }

                    // Density
                    const densityValue = extractDensityValue(reading);
                    if (densityValue !== null) {
                        hasRealDensity = true;
                        if (!densityLookup[yearMonth]) densityLookup[yearMonth] = {};
                        densityLookup[yearMonth][stationId] = densityValue;
                    }

                    // ++ Salinity ++
                    const salinityValue = extractSalinityValue(reading);
                    if (salinityValue !== null) {
                        hasRealSalinity = true;
                        if (!salinityLookup[yearMonth]) salinityLookup[yearMonth] = {};
                        salinityLookup[yearMonth][stationId] = salinityValue;
                    }
                  } catch (parseError) { console.warn(`Error parsing reading for ${stationId}:`, parseError); }
                });
            });
             // Average temps
             const averagedTempData = {};
             for (const yearMonth in tempLookup) {
                const temps = tempLookup[yearMonth];
                if (temps.length > 0) { averagedTempData[yearMonth] = temps.reduce((a, b) => a + b, 0) / temps.length; }
             }
             tempLookup = averagedTempData;
         }
      } else { errorMessage = `API fetch failed: ${response.status} ${response.statusText}`; console.warn(errorMessage); }
    } catch (apiError) { errorMessage = `Error fetching from API: ${apiError.message}`; console.error(errorMessage, apiError); }

    // Process hardcoded temperature data (keep as before)
    try {
      const tempResult = processTemperatureData(Array.from(timePointsSet), tempLookup);
      if (tempResult) {
         timePointsSet = new Set(tempResult.timePoints);
         tempLookup = tempResult.temperatureData;
      }
    } catch (tempError) { console.warn("Error processing temperature data:", tempError); }

    // Filter and sort time points (keep as before)
    const allTimePoints = Array.from(timePointsSet)
      .filter(yearMonth => { const [year] = yearMonth.split('-').map(Number); return year >= 2000; })
      .sort();

    // --- Generate/Supplement Density & Salinity ---
    let usingMockData = false;
    if (processedStations.length > 0 && allTimePoints.length > 0) {
        if (!hasRealDensity) {
            console.log("Generating synthetic density data.");
            densityLookup = generateMockDensityForStations(processedStations, allTimePoints, tempLookup);
            usingMockData = true; // Mark if density is fully mocked
        } else {
             console.log("Supplementing density data.");
             const syntheticDensity = generateMockDensityForStations(processedStations, allTimePoints, tempLookup);
             allTimePoints.forEach(yearMonth => {
                if (!densityLookup[yearMonth]) densityLookup[yearMonth] = {};
                processedStations.forEach(station => {
                    if (densityLookup[yearMonth][station.id] === undefined &&
                        syntheticDensity[yearMonth]?.[station.id] !== undefined) {
                        densityLookup[yearMonth][station.id] = syntheticDensity[yearMonth][station.id];
                    }
                });
             });
        }

        // ++ Generate/Supplement Salinity ++
        if (!hasRealSalinity) {
            console.log("Generating synthetic salinity data.");
            salinityLookup = generateMockSalinityForStations(processedStations, allTimePoints, tempLookup);
             // Set usingMockData only if density is also mocked
             if (!hasRealDensity) usingMockData = true;
        } else {
             console.log("Supplementing salinity data.");
              const syntheticSalinity = generateMockSalinityForStations(processedStations, allTimePoints, tempLookup);
              allTimePoints.forEach(yearMonth => {
                 if (!salinityLookup[yearMonth]) salinityLookup[yearMonth] = {};
                 processedStations.forEach(station => {
                      if (salinityLookup[yearMonth][station.id] === undefined &&
                          syntheticSalinity[yearMonth]?.[station.id] !== undefined) {
                          salinityLookup[yearMonth][station.id] = syntheticSalinity[yearMonth][station.id];
                      }
                 });
              });
        }
    }

    // --- Handle complete mock data generation if necessary ---
    if (processedStations.length === 0 || allTimePoints.length === 0) {
        // ... (This section is largely the same as before, ensure it generates both lookups) ...
        console.warn("Insufficient initial data. Generating complete mock dataset.");
        usingMockData = true;
        errorMessage = errorMessage || "Data unavailable. Displaying simulated data.";
         processedStations = ALLOWED_SITES.map((id, index) => ({
             id, name: `Site ${id}`, longitude: -112.5 + 0.2 * Math.cos(index / ALLOWED_SITES.length * 2 * Math.PI),
             latitude: 41.0 + 0.2 * Math.sin(index / ALLOWED_SITES.length * 2 * Math.PI), coordsSource: 'mock'
         }));
         const mockTimePoints = []; // generate points from 2000 to present
         const startYear = 2000; const endYear = new Date().getFullYear(); const endMonth = new Date().getMonth() + 1;
         for (let y = startYear; y <= endYear; y++) {
            const mLimit = y === endYear ? endMonth : 12;
            for (let m = 1; m <= mLimit; m++) mockTimePoints.push(`${y}-${m.toString().padStart(2, '0')}`);
         }
         allTimePoints.push(...mockTimePoints.filter(tp => !allTimePoints.includes(tp)));
         allTimePoints.sort();
         allTimePoints.forEach(tp => {
            if (!tempLookup[tp]) {
              const [y, m] = tp.split('-').map(Number);
              tempLookup[tp] = 50 + Math.sin((m - 1) / 12 * 2 * Math.PI) * 25 + (y - startYear) * 0.2 + (Math.random() - 0.5) * 5;
            }
         });
        densityLookup = generateMockDensityForStations(processedStations, allTimePoints, tempLookup);
        salinityLookup = generateMockSalinityForStations(processedStations, allTimePoints, tempLookup);
    }

    // --- Calculate ranges for BOTH variables ---
    const calculateRange = (dataLookup) => {
        let range = [null, null];
        const allValues = [];
        if (dataLookup && typeof dataLookup === 'object') {
            Object.values(dataLookup).forEach(monthData => {
                if (monthData && typeof monthData === 'object') {
                    Object.values(monthData).forEach(value => {
                        if (typeof value === 'number' && !isNaN(value)) {
                            allValues.push(value);
                        }
                    });
                }
            });
        }
        if (allValues.length > 0) {
            const minVal = Math.min(...allValues);
            const maxVal = Math.max(...allValues);
            const padding = (maxVal - minVal) * 0.02 || (maxVal * 0.02); // Add padding, handle min=max
            range = [Math.max(0, minVal - padding), maxVal + padding];
            if (range[0] >= range[1]) { // Ensure range is valid if min=max
               range[0] = Math.max(0, range[0] * 0.9);
               range[1] = range[1] * 1.1 || 0.1; // Ensure max is slightly > min
            }
        }
         if (range[0] === null) range = [0, 1]; // Basic default if no data
        return range;
    };

    const densityRange = calculateRange(densityLookup);
    const salinityRange = calculateRange(salinityLookup);

    // Apply specific defaults if calculation resulted in [0, 1] or still null
    const finalDensityRange = (densityRange[0] === 0 && densityRange[1] === 1) || densityRange[0] === null ? [1.0, 1.25] : densityRange;
    const finalSalinityRange = (salinityRange[0] === 0 && salinityRange[1] === 1) || salinityRange[0] === null ? [50, 250] : salinityRange;


    // --- Structure the return object ---
    return {
      stations: processedStations,
      timePoints: allTimePoints,
      allData: {
          density: densityLookup,
          salinity: salinityLookup,
          temperature: tempLookup
      },
      dataRanges: {
          density: finalDensityRange,
          salinity: finalSalinityRange
      },
      usingMockData,
      error: errorMessage
    };

  } catch (err) {
    // --- Fallback ---
     console.error('DataLoader Critical Error:', err);
     const mockStations = ALLOWED_SITES.map((id, index) => ({ id, name: `Site ${id}`, longitude: -112.5 + 0.2 * Math.cos(index / ALLOWED_SITES.length * 2 * Math.PI), latitude: 41.0 + 0.2 * Math.sin(index / ALLOWED_SITES.length * 2 * Math.PI), coordsSource: 'mock' }));
     const mockTimePoints = []; const startYear = 2000; const endYear = 2025; const currentMonth = new Date().getMonth() + 1;
     for (let y = startYear; y <= endYear; y++) { for (let m = 1; m <= 12; m++) { if (y === endYear && m > currentMonth) continue; mockTimePoints.push(`${y}-${m.toString().padStart(2, '0')}`); } }
     const mockTempData = {}; mockTimePoints.forEach(tp => { const [y, m] = tp.split('-').map(Number); mockTempData[tp] = 50 + Math.sin((m - 1) / 12 * 2 * Math.PI) * 25 + (y - startYear) * 0.2 + (Math.random() - 0.5) * 5; });
     const mockDensityData = generateMockDensityForStations(mockStations, mockTimePoints, mockTempData);
     const mockSalinityData = generateMockSalinityForStations(mockStations, mockTimePoints, mockTempData);

     return {
       stations: mockStations,
       timePoints: mockTimePoints,
       allData: { density: mockDensityData, salinity: mockSalinityData, temperature: mockTempData },
       dataRanges: { density: [1.05, 1.20], salinity: [50, 250] },
       usingMockData: true,
       error: `Failed to load data: ${err.message}`
     };
  }
};