import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import proj4 from 'proj4'; // Ensure 'proj4' is installed (npm install proj4 or yarn add proj4)

// Define UTM Zone 12N projection string (common for GSL area)
const utmZone12N = '+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs';
// Define WGS84 (lat/lon) projection string
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

/**
 * React component to display a heatmap of Great Salt Lake density over time.
 * Fetches data from a PostgREST API, converts coordinates, interpolates density,
 * and renders using D3.js within an SVG element. Includes time slider and animation.
 */
const GreatSaltLakeHeatmap = () => {
  // --- State Hooks ---
  const [lakeData, setLakeData] = useState(null); // GeoJSON outline
  const [siteData, setSiteData] = useState([]); // Raw site data from API (optional to keep)
  const [stations, setStations] = useState([]); // Processed station data with correct coordinates
  const [timePoints, setTimePoints] = useState([]); // Array of 'YYYY-MM' strings
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0); // Index for timePoints array
  const [densityData, setDensityData] = useState({}); // Nested object: { 'YYYY-MM': { stationId: density } }
  const [temperatureData, setTemperatureData] = useState({}); // Object: { 'YYYY-MM': avg_temperature }
  const [densityRange, setDensityRange] = useState([1.0, 1.25]); // Min/Max for color scale
  const [isLoading, setIsLoading] = useState(true); // Loading indicator state
  const [playing, setPlaying] = useState(false); // Animation playing state
  const [error, setError] = useState(null); // Error message state
  const [usingMockData, setUsingMockData] = useState(false); // Flag if mock data is active

  // --- Refs ---
  const playTimerRef = useRef(null); // Ref for animation interval timer
  const svgRef = useRef(null); // Ref for the SVG element
  const lastUpdateTimeRef = useRef(0); // Ref for debouncing slider updates (optional)

  // --- Configuration ---
  const API_ENDPOINT = 'https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app/gsl_brine_sites';
  const API_HEADERS = { 'Accept': 'application/json', 'Accept-Profile': 'emp' };
  const MAP_WIDTH = 800; // Intrinsic width for viewBox calculation
  const MAP_HEIGHT = 500; // Intrinsic height for viewBox calculation
  const ANIMATION_INTERVAL = 500; // Interval for animation playback in milliseconds
  const DEBOUNCE_THRESHOLD = 150; // Threshold for debouncing slider updates (optional)

  // --- Derived State ---
  // Calculate the current time point string based on the index
  const currentTimePoint = timePoints[currentTimeIndex] || '';

  // --- Memoized Projection ---
  // Create the D3 projection function, memoized to avoid recalculation unless lakeData changes
  const projection = useMemo(() => {
    if (!lakeData) return null; // Cannot create projection without GeoJSON data
    try {
      // Use D3's Mercator projection, fitted to the lake's bounding box
      return d3.geoMercator()
        .fitExtent([[20, 20], [MAP_WIDTH - 20, MAP_HEIGHT - 20]], lakeData);
    } catch (err) {
        console.error("Error creating projection:", err);
        setError("Failed to create map projection from GeoJSON data.");
        return null; // Return null on error
    }
  }, [lakeData]); // Dependency: only recalculate if lakeData changes

  // --- Helper Function for Averaging Density ---
  // Defined here as it's used within renderHeatmap
  const calculateAverageDensity = (densityMap) => {
      if (!densityMap || typeof densityMap !== 'object') return null;
      // Filter out non-numeric values and calculate the average
      const densities = Object.values(densityMap).filter(d => typeof d === 'number' && !isNaN(d));
      if (densities.length === 0) return null;
      const sum = densities.reduce((acc, val) => acc + val, 0);
      return sum / densities.length;
  };

  // --- Rendering Function (Memoized) ---
  // **** DEFINED HERE: Before the useEffect hook that depends on it ****
  // This function handles drawing the map, heatmap, stations, legend, etc.
  const renderHeatmap = useCallback(() => {
    // --- Prerequisite Checks ---
    // Ensure all required elements and data are ready before attempting to render
    if (!svgRef.current || !lakeData || !projection || !stations) {
        return; // Exit if SVG ref, map data, projection, or stations aren't ready
    }
    // Handle case where stations might be an empty array after loading attempt
    if (stations.length === 0 && !isLoading) {
         const svg = d3.select(svgRef.current);
         svg.selectAll("*").remove(); // Clear previous content
         // Display a message indicating no station data
         svg.append("text")
            .attr("x", MAP_WIDTH / 2)
            .attr("y", MAP_HEIGHT / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#aaa")
            .text("No station data loaded.");
         return;
    }

    // --- Rendering Logic ---
    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove(); // Clear previous render content

      // Get data for the current time point
      const currentTemp = temperatureData[currentTimePoint];
      const currentDensityMap = densityData[currentTimePoint] || {}; // Ensure it's an object
      const avgDensity = calculateAverageDensity(currentDensityMap); // Calculate average density

      // --- Create In-Memory Canvas for Heatmap ---
      // Drawing the heatmap grid on an off-screen canvas is often more performant
      const canvas = document.createElement('canvas');
      canvas.width = MAP_WIDTH;
      canvas.height = MAP_HEIGHT;
      const ctx = canvas.getContext('2d');

      // --- Define D3 Path Generator ---
      const path = d3.geoPath().projection(projection);

      // --- Draw Lake Boundary and Create Clip Path ---
      // A clip path ensures the heatmap is only drawn within the lake's boundaries
      try {
          svg.append("defs")
             .append("clipPath")
             .attr("id", "lake-clip") // ID used to apply the clip path
             .append("path")
             .datum(lakeData) // Use the GeoJSON data
             .attr("d", path); // Generate the path string

          // Optionally draw the lake outline visually
          svg.append("path")
            .datum(lakeData)
            .attr("d", path)
            .attr("fill", "none") // No fill for the outline itself
            .attr("stroke", "#2b8cbe") // Outline color
            .attr("stroke-width", 1.5)
            .attr("vector-effect", "non-scaling-stroke"); // Keep stroke width constant if SVG scales

      } catch (pathError) {
          // Handle errors during boundary drawing (e.g., invalid GeoJSON)
          console.error("Error rendering lake boundary:", pathError);
           // Provide a fallback rectangular clip path
           svg.append("defs")
             .append("clipPath")
             .attr("id", "lake-clip")
             .append("rect")
             .attr("x", 0).attr("y", 0)
             .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT);
           // Draw a visual error indicator
           svg.append("rect")
             .attr("x", 0).attr("y", 0)
             .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT)
             .attr("fill", "none").attr("stroke", "#ff0000").attr("stroke-width", 2);
           svg.append("text").attr("x", 10).attr("y", 20).text("Error: Lake boundary failed").attr("fill", "red");
           return; // Stop rendering if boundary fails critically
      }

      // --- Color Scale for Heatmap ---
      // Use a sequential blue color scale (lighter = lower density, darker = higher)
      const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([densityRange[1], densityRange[0]]); // Invert domain: map higher density to darker blue

      // --- Prepare Data Points for Heatmap Interpolation ---
      // Convert station locations and density values into {x, y, value} objects
      const dataPoints = stations.map(station => {
          const density = currentDensityMap[station.id];
          // Check for valid density and coordinates
          if (density !== undefined && density !== null && !isNaN(station.longitude) && !isNaN(station.latitude)) {
              try {
                  // Project geographic coordinates to SVG coordinates
                  const projected = projection([station.longitude, station.latitude]);
                  // Ensure projection was successful
                  if (projected && !isNaN(projected[0]) && !isNaN(projected[1])) {
                      return { x: projected[0], y: projected[1], value: density };
                  }
              } catch (projErr) { /* Ignore projection errors for individual points */ }
          }
          return null; // Return null for stations without data or invalid coords/projection
      }).filter(p => p !== null); // Filter out the null entries

      // --- Generate Heatmap using IDW (Inverse Distance Weighting) ---
      // PERFORMANCE NOTE: This manual IDW on a pixel grid can be computationally intensive
      // for many data points or large maps. Consider optimized libraries or different
      // interpolation methods (e.g., d3-contour) if performance becomes an issue.
      if (dataPoints.length > 0) {
        const cellSize = 5; // Size of each interpolated grid cell in pixels
        const gridCols = Math.ceil(MAP_WIDTH / cellSize);
        const gridRows = Math.ceil(MAP_HEIGHT / cellSize);

        // IDW function: Calculates interpolated value at (x, y) based on nearby points
        const idw = (x, y, points, power = 2) => {
            let numerator = 0;
            let denominator = 0;
            let exactMatchValue = null; // Handle cases where (x,y) is exactly a data point

            points.forEach(point => {
              const distanceSq = Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2);
              // If the target point is exactly a data point, use its value directly
              if (distanceSq === 0) { exactMatchValue = point.value; return; }

              // Calculate weight based on inverse distance (power defaults to 2)
              const weight = 1 / Math.pow(distanceSq, power / 2);
              numerator += point.value * weight;
              denominator += weight;
            });

            if (exactMatchValue !== null) return exactMatchValue;
            // Avoid division by zero if no points contribute weight
            return denominator === 0 ? null : numerator / denominator;
        };

        // Iterate over the grid cells
        for (let col = 0; col < gridCols; col++) {
          for (let row = 0; row < gridRows; row++) {
            // Calculate the center coordinates of the current cell
            const cellX = col * cellSize + cellSize / 2;
            const cellY = row * cellSize + cellSize / 2;
            try {
              // Check if the cell center is geographically inside the lake
              const inverted = projection.invert([cellX, cellY]); // Convert SVG coords back to Geo coords
              if (inverted && d3.geoContains(lakeData, inverted)) { // Check if Geo coords are within the lake polygon
                 // Calculate the interpolated density value for the cell center
                 const interpolatedValue = idw(cellX, cellY, dataPoints);
                 if (interpolatedValue !== null) {
                    // Set the fill color based on the interpolated value
                    ctx.fillStyle = colorScale(interpolatedValue);
                    // Draw the cell rectangle on the in-memory canvas
                    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                 }
              }
            } catch (geoError) {
                // Ignore minor errors during inversion/containment checks near boundaries
                continue;
            }
          }
        }

         // Draw the generated heatmap (from the in-memory canvas) onto the SVG
         svg.append("g")
            .attr("clip-path", "url(#lake-clip)") // Apply the lake boundary clip path
            .append("image")
            .attr("x", 0).attr("y", 0)
            .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT)
            .attr("preserveAspectRatio", "none") // Don't preserve aspect ratio of the canvas image
            .attr("href", canvas.toDataURL()); // Embed the canvas content as a data URL

      } else { // Display message if no data points available for heatmap interpolation
         svg.append("text")
            .attr("x", MAP_WIDTH / 2).attr("y", MAP_HEIGHT / 2)
            .attr("text-anchor", "middle").attr("fill", "#aaa")
            .text("No density data available for heatmap this month");
      }

      // --- Draw Stations ---
      // Draw circles representing the sampling stations on top of the heatmap
      const stationGroup = svg.append("g").attr("class", "stations");
      stations.forEach(station => {
        // Skip if coordinates are invalid
        if (isNaN(station.longitude) || isNaN(station.latitude)) return;
        try {
          // Project station coordinates
          const projected = projection([station.longitude, station.latitude]);
          if (!projected || isNaN(projected[0]) || isNaN(projected[1])) return; // Skip if projection fails

          const [x, y] = projected;
          const density = currentDensityMap[station.id]; // Get density for this station/time
          const hasData = density !== undefined && density !== null;
          // Color the station circle based on its density, or grey if no data
          const fillColor = hasData ? colorScale(density) : "#ccc";

          // Create a group for the station circle and tooltip
          const g = stationGroup.append("g").attr("transform", `translate(${x}, ${y})`);

          // Draw the circle
          g.append("circle")
            .attr("r", 5) // Radius of the circle
            .attr("fill", fillColor)
            .attr("stroke", "#333") // Outline color
            .attr("stroke-width", 1);

          // Add a tooltip (title element) showing station name and density/status
          const tooltipText = hasData
            ? `${station.name}: ${density.toFixed(3)} g/cm³`
            : `${station.name}: No data`;
          g.append("title").text(tooltipText);

        } catch (projErr) { /* Ignore errors during individual station drawing */ }
      });

      // --- Add Legend ---
      // Draw the color scale legend
      const legendWidth = 200; const legendHeight = 10;
      const legendX = MAP_WIDTH - legendWidth - 30; // Position bottom-right
      const legendY = MAP_HEIGHT - legendHeight - 40;
      const legendSvg = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`);

      // Add a semi-transparent background for better visibility
      legendSvg.append("rect")
          .attr("x", -5).attr("y", -20)
          .attr("width", legendWidth + 10).attr("height", legendHeight + 40)
          .attr("fill", "rgba(255, 255, 255, 0.8)");

      // Legend title
      legendSvg.append("text")
          .attr("x", 0).attr("y", -5)
          .style("font-size", "12px").style("font-weight", "bold")
          .text("Density (g/cm³)");

      // Define scale and axis for the legend labels
      const legendScale = d3.scaleLinear().domain(densityRange).range([0, legendWidth]);
      const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d3.format(".2f"));

      // Create a gradient definition for the legend color bar
      const defs = svg.select("defs"); // Reuse existing defs or create if needed
      if (defs.empty()) defs = svg.append("defs");
      const gradient = defs.append("linearGradient")
          .attr("id", "density-gradient") // Unique ID for the gradient
          .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%"); // Horizontal gradient

      // Add color stops to the gradient based on the color scale
      const numStops = 10; // Number of stops for smoother gradient
      for (let i = 0; i <= numStops; i++) {
          const t = i / numStops; // Interpolation factor (0 to 1)
          // Calculate value at this point in the domain and get its color
          gradient.append("stop")
              .attr("offset", `${t * 100}%`)
              .attr("stop-color", colorScale(densityRange[0] + (densityRange[1] - densityRange[0]) * t));
      }

      // Draw the legend color bar rectangle using the gradient
      legendSvg.append("rect")
          .attr("x", 0).attr("y", 0)
          .attr("width", legendWidth).attr("height", legendHeight)
          .style("fill", "url(#density-gradient)"); // Apply the gradient fill

      // Draw the legend axis (labels) below the color bar
      legendSvg.append("g")
          .attr("transform", `translate(0, ${legendHeight})`)
          .call(legendAxis)
          .select(".domain").remove(); // Remove the axis line itself


      // --- Add Title & Info Text ---
      // Display the current time point and calculated average values
      svg.append("text")
        .attr("x", MAP_WIDTH / 2).attr("y", 30) // Position top-center
        .attr("text-anchor", "middle")
        .style("font-size", "16px").style("font-weight", "bold")
        .text(`Great Salt Lake Density - ${currentTimePoint}`);
      svg.append("text")
        .attr("x", MAP_WIDTH / 2).attr("y", 50) // Position below title
        .attr("text-anchor", "middle").style("font-size", "12px")
        .text(`Avg Temp: ${currentTemp ? currentTemp.toFixed(1) + '°F' : 'N/A'} | Avg Density: ${avgDensity ? avgDensity.toFixed(3) + ' g/cm³' : 'N/A'}`);

    } catch (renderErr) {
      // Catch unexpected errors during the rendering process
      console.error("Error during heatmap rendering:", renderErr);
      // Attempt to display an error message directly on the SVG
      const svg = d3.select(svgRef.current);
      if (svg) {
        svg.selectAll("*").remove(); // Clear potentially broken content
        svg.append("text").attr("x", MAP_WIDTH/2).attr("y", MAP_HEIGHT/2)
           .attr("text-anchor", "middle").attr("fill", "red")
           .text("Error rendering visualization.");
      }
    }
  }, [lakeData, stations, projection, currentTimePoint, temperatureData, densityData, densityRange, isLoading]); // Dependencies for useCallback


  // --- Data Loading Function ---
  // Defined here, called by useEffect below. Not memoized with useCallback as it's typically called only once.
  const loadData = async () => {
    // Reset state for new load attempt
    setIsLoading(true);
    setError(null);
    setUsingMockData(false);
    console.log("Fetching data from PostgREST API...");

    try {
      // Fetch site data from the API
      const response = await fetch(API_ENDPOINT, { method: 'GET', headers: API_HEADERS });
      console.log("API Response Status:", response.status, response.statusText);
      if (!response.ok) throw new Error(`API fetch failed: ${response.status} ${response.statusText}`);

      // Parse the JSON response
      let sitesJson;
      try { sitesJson = await response.json(); }
      catch (jsonError) { throw new Error("Invalid data format received from API."); }

      console.log("Sites data received:", sitesJson.length);
      setSiteData(sitesJson); // Store raw data (optional)

      // --- Process Site Data (Coordinate Conversion) ---
      // Map raw site data to processed station objects, converting coordinates
      const processedStations = sitesJson.map(site => {
          const stationId = site.site || `site-${site.id}`;
          let longitude = null, latitude = null, coordsSource = 'none';
          try {
            // Try parsing 'geom' field (GeoJSON Point)
            if (site.geom) {
              let geomObj = site.geom; if (typeof site.geom === 'string') { try { geomObj = JSON.parse(site.geom); } catch { geomObj = null; }}
              if (geomObj && geomObj.type === 'Point' && Array.isArray(geomObj.coordinates) && geomObj.coordinates.length === 2) {
                  longitude = geomObj.coordinates[0]; latitude = geomObj.coordinates[1]; coordsSource = 'geom';
              }
            }
            // If 'geom' failed or missing, try UTM coordinates
            if (coordsSource === 'none' && site.utmeasting != null && site.utmnorthing != null) {
                const easting = parseFloat(site.utmeasting); const northing = parseFloat(site.utmnorthing);
                 if (!isNaN(easting) && !isNaN(northing)) {
                     // Convert UTM Zone 12N to WGS84 Lon/Lat using proj4
                     const lonLat = proj4(utmZone12N, wgs84, [easting, northing]);
                     longitude = lonLat[0]; latitude = lonLat[1]; coordsSource = 'utm';
                 }
            }
          } catch (coordError) { console.warn(`Coord error site ${stationId}:`, coordError); }
          // Use default coordinates if both methods fail
          if (coordsSource === 'none') { console.warn(`Using default coords for site ${stationId}`); longitude = -112.5; latitude = 41.0; }
          return { id: stationId, name: site.site || `Site ${site.id}`, longitude, latitude, coordsSource };
      }).filter(st => st.longitude != null && st.latitude != null); // Filter out stations where coordinates couldn't be determined

      console.log(`Processed ${processedStations.length} stations with coordinates.`);
      setStations(processedStations); // Update state with processed stations

      // --- Process Readings ---
      // Extract temperature, density, and time points from nested readings data
      const tempLookup = {}; const densityLookup = {}; const timePointsSet = new Set();
      let hasRealReadings = false; // Flag to track if any valid readings were found
      sitesJson.forEach(site => {
        const stationId = site.site || `site-${site.id}`;
        // Only process readings for stations that were successfully processed (have coords)
        const stationExists = processedStations.some(ps => ps.id === stationId);
        if (!stationExists || !site.readings || !Array.isArray(site.readings)) return;

        site.readings.forEach(reading => {
          if (!reading.date) return; // Skip if no date
          hasRealReadings = true; // Mark that we found data
          try {
            // Parse date and format as 'YYYY-MM'
            const dateObj = new Date(reading.date); if (isNaN(dateObj.getTime())) return; // Skip invalid dates
            const year = dateObj.getFullYear(); const month = (dateObj.getMonth() + 1).toString().padStart(2, '0'); const yearMonth = `${year}-${month}`;
            timePointsSet.add(yearMonth); // Add to set of unique time points

            // Store temperature readings (will be averaged later)
            if (reading.temperature != null) {
                 if (!tempLookup[yearMonth]) tempLookup[yearMonth] = [];
                 tempLookup[yearMonth].push(reading.temperature);
            }

            // Store density or calculate approximate density from salinity
            let densityValue = null;
            if (reading.density != null) { densityValue = reading.density; }
            else if (reading.salinity != null) { densityValue = 1 + (reading.salinity * 0.0008); } // Simplified approximation

            if (densityValue !== null) {
                 if (!densityLookup[yearMonth]) densityLookup[yearMonth] = {};
                 densityLookup[yearMonth][stationId] = densityValue; // Store density for this station/time
            }
          } catch (parseError) { console.warn(`Error parsing reading for ${stationId}:`, parseError); }
        });
      });

      // --- Averaging Monthly Temperatures ---
      // Calculate the average temperature for each month from collected readings
      const averagedTempData = {};
      for (const yearMonth in tempLookup) {
          const temps = tempLookup[yearMonth];
          if (temps.length > 0) { averagedTempData[yearMonth] = temps.reduce((a, b) => a + b, 0) / temps.length; }
      }

      // --- Handle No Real Data / Generate Mock Data ---
      // If no valid readings were found in the API data, generate mock data for demonstration
      if (!hasRealReadings && processedStations.length > 0) { // Only mock if stations exist
        console.warn("No valid readings found. Generating mock data.");
        setUsingMockData(true); // Set flag to display notice
        // Generate mock data for a range of years/months
        const startYear = 2000; const endYear = new Date().getFullYear(); const currentMonth = new Date().getMonth() + 1;
        for (let year = startYear; year <= endYear; year++) {
          for (let month = 1; month <= 12; month++) {
            if (year === endYear && month > currentMonth) continue; // Don't generate for future months
            const monthStr = month.toString().padStart(2, '0'); const yearMonth = `${year}-${monthStr}`;
            timePointsSet.add(yearMonth); // Add mock time point
            // Mock temperature with seasonal variation
            const baseTemp = 50 + Math.sin((month - 1) / 12 * 2 * Math.PI) * 25; const yearEffect = (year - startYear) * 0.1;
            averagedTempData[yearMonth] = baseTemp + yearEffect + (Math.random() - 0.5) * 5;
            // Mock density for each station with variation
            densityLookup[yearMonth] = {};
            processedStations.forEach((station, index) => {
              let baseDensity = 1.10 + (year - startYear) * 0.001 + Math.sin((month - 1) / 12 * 2 * Math.PI) * 0.01 + (Math.random() - 0.5) * 0.02 + (index / Math.max(1, processedStations.length)) * 0.05;
              densityLookup[yearMonth][station.id] = Math.max(1.0, Math.min(1.3, baseDensity)); // Clamp mock values
            });
          }
        }
      }

      // --- Finalize Time Points and Data ---
      // Convert Set to sorted Array
      const allTimePoints = Array.from(timePointsSet).sort();
      // Handle edge case where no time points exist even after mocking attempt
      if (allTimePoints.length === 0) {
          console.warn("No time points available. Creating default.");
          const year = new Date().getFullYear(); allTimePoints.push(`${year}-01`);
          if (!densityLookup[`${year}-01`]) densityLookup[`${year}-01`] = {};
          if (!averagedTempData[`${year}-01`]) averagedTempData[`${year}-01`] = undefined;
      }

      // Update state with processed data
      setTemperatureData(averagedTempData);
      setDensityData(densityLookup);
      setTimePoints(allTimePoints);

      // --- Calculate Density Range ---
      // Determine the min/max density across all time points for the color scale
      const allDensities = [];
      Object.values(densityLookup).forEach(monthData => {
        Object.values(monthData).forEach(density => {
          if (typeof density === 'number' && !isNaN(density)) allDensities.push(density);
        });
      });
      if (allDensities.length > 0) {
        const minD = Math.min(...allDensities); const maxD = Math.max(...allDensities);
        // Set range with a small buffer, clamped to reasonable bounds
        setDensityRange([ Math.max(1.0, minD * 0.99), Math.min(1.35, maxD * 1.01) ]);
      } else {
        setDensityRange([1.0, 1.25]); // Default range if no density data found
      }

      setIsLoading(false); // Set loading false at the very end of successful processing

    } catch (err) {
      // Handle errors during data fetching or processing
      console.error('Error loading or processing data:', err);
      setError(`Failed data load: ${err.message}`);
      setIsLoading(false); // Ensure loading stops on error
      // Optionally clear data state on critical errors
      // setStations([]); setTimePoints([]); setDensityData({}); setTemperatureData({});
    }
  };


  // --- Effects ---

  // Initial Data Load Effect (Runs once on component mount)
  useEffect(() => {
    // Define async function to load GeoJSON map data
    const loadGeoJson = async () => {
      try {
        const response = await fetch('./data/GSL_Outline.json'); // Adjust path if needed
        if (!response.ok) throw new Error(`HTTP error loading GeoJSON! status: ${response.status}`);
        let gslGeoJson;
        try { gslGeoJson = await response.json(); }
        catch (jsonError) { throw new Error('Invalid GeoJSON format received.'); }
        setLakeData(gslGeoJson); // Update state with map data
      } catch (err) {
        console.error('Error loading GeoJSON:', err);
        setError(`Failed to load map: ${err.message}`);
        // Do not set isLoading false here; let loadData handle the final loading state
      }
    };

    loadGeoJson(); // Start loading GeoJSON
    loadData(); // Start loading API data (can run concurrently)
  }, []); // Empty dependency array ensures this runs only once

  // Heatmap Rendering Effect (Runs when dependencies change)
  // **** THIS useEffect NOW CORRECTLY REFERENCES renderHeatmap DEFINED ABOVE ****
  useEffect(() => {
    // Only attempt to render if projection is ready, data isn't loading, and map/time data exists
    if (projection && !isLoading && lakeData && timePoints.length > 0) {
      // Use requestAnimationFrame for smoother rendering, especially during animation
      const animationId = requestAnimationFrame(() => {
        renderHeatmap(); // Call the main rendering function
      });
      // Cleanup function: cancel the animation frame if the component unmounts or dependencies change
      return () => cancelAnimationFrame(animationId);
    }
    // Dependencies: Effect reruns if any of these values change
  }, [currentTimeIndex, isLoading, lakeData, timePoints.length, projection, renderHeatmap]);

  // Animation Play/Pause Effect (Manages the interval timer)
  useEffect(() => {
    if (playing) { // If animation is playing
      // Set up an interval timer to advance the time index
      playTimerRef.current = setInterval(() => {
        setCurrentTimeIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          // Stop playing at the end of the time points
          if (nextIndex >= timePoints.length) {
            setPlaying(false); // Turn off playing state
            return timePoints.length - 1; // Stay at the last frame
          }
          return nextIndex; // Move to the next frame
        });
      }, ANIMATION_INTERVAL);
    } else if (playTimerRef.current) {
      // If not playing and timer exists, clear the interval
      clearInterval(playTimerRef.current);
    }
    // Cleanup function: clear the interval timer if the component unmounts or dependencies change
    return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
  }, [playing, timePoints.length]); // Dependencies: effect reruns if playing state or timePoints change


  // --- Event Handlers (Memoized with useCallback) ---

  // Handles changes to the time slider input
  const handleSliderChange = useCallback((e) => {
    const newIndex = parseInt(e.target.value, 10);
    setCurrentTimeIndex(newIndex); // Update the time index immediately for responsiveness
    if (playing) setPlaying(false); // Stop animation if slider is manually moved
  }, [playing]); // Dependency: playing state (to stop animation)

  // Handles when the user finishes interacting with the slider (mouse up / touch end)
  const handleSliderFinish = useCallback((e) => {
     // Optional: Could trigger final update or validation if needed,
     // but immediate update in handleSliderChange is usually sufficient.
     setCurrentTimeIndex(parseInt(e.target.value, 10));
  }, []); // No dependencies needed if just setting state

  // Toggles the animation playing state
  const togglePlay = useCallback(() => {
    setPlaying(prev => !prev); // Toggle boolean state
  }, []); // No dependencies needed

  // --- Render Component ---

  // --- Loading State ---
  // Show a simple loading message initially before the map is loaded
  if (isLoading && !lakeData && !error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-lg animate-pulse">Loading Great Salt Lake Map & Data...</p>
      </div>
    );
  }

  // --- Critical Error State ---
  // Show an error if the essential map data failed to load
  if (error && !lakeData) {
     return (
       <div className="flex flex-col items-center justify-center h-96 text-red-600 bg-red-50 p-4 rounded border border-red-200">
         <p className="text-lg font-semibold mb-2">Error Loading Map Data</p>
         <p className="text-sm">{error}</p>
         <p className="text-xs mt-2">Please ensure 'GSL_Outline.json' is accessible in the public/data folder.</p>
       </div>
     );
   }

  // --- Main Component Render ---
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-lg">
      {/* --- Header --- */}
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-blue-800">Great Salt Lake Density Heatmap</h2>
      <p className="text-center mb-4 text-gray-600 text-sm sm:text-base">Monthly Density and Temperature Visualization</p>

      {/* --- Status Messages --- */}
      {/* Non-critical Error Banner (e.g., API data load failure after map loaded) */}
      {error && lakeData && (
          <div className="mb-4 p-3 text-center text-yellow-800 bg-yellow-50 rounded border border-yellow-200 text-sm">
              <strong>Warning:</strong> {error}
          </div>
      )}
       {/* Mock Data Notice */}
       {usingMockData && (
           <div className="mb-4 p-3 text-center text-blue-800 bg-blue-50 rounded border border-blue-200 text-sm">
               <strong>Note:</strong> Using generated example data as no measured readings were found in the source.
           </div>
       )}

      {/* --- Visualization Area --- */}
      <div className="mb-6 bg-gray-50 rounded-lg p-2 sm:p-4 shadow-inner relative">
        {/* Loading Overlay (shown during data refreshes after initial load) */}
        {isLoading && lakeData && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                <p className="text-lg text-blue-600 animate-pulse">Loading data...</p>
            </div>
        )}
        {/* Container for the SVG map, maintaining aspect ratio */}
        <div className="relative border rounded-lg bg-gray-100 overflow-hidden mb-4 shadow aspect-w-16 aspect-h-10 sm:aspect-h-9">
          {/* SVG Element: D3 will draw into this */}
          <svg
            ref={svgRef} // Assign the ref for D3 selection
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} // Define intrinsic dimensions for scaling
            preserveAspectRatio="xMidYMid meet" // Control scaling behavior
            className="absolute top-0 left-0 w-full h-full block" // Make SVG fill the container
            style={{ backgroundColor: "#f0f7fa" }} // Set a light background color
          >
            {/* SVG content is generated dynamically by the renderHeatmap function */}
          </svg>
        </div>

        {/* --- Controls Area --- */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 space-y-3 sm:space-y-0 px-2">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading || timePoints.length <= 1} // Disable if loading or only one time point
            className={`px-4 py-2 rounded-lg font-medium transition-opacity text-sm sm:text-base ${
              playing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
            } text-white shadow disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {playing ? 'Pause' : 'Play Animation'}
          </button>

          {/* Current Time Point Display */}
          <div className="text-xs sm:text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded-md shadow whitespace-nowrap">
            {timePoints.length > 0 ? (
              `${currentTimePoint} (${currentTimeIndex + 1}/${timePoints.length})` // Show current/total
            ) : (
              isLoading ? 'Loading...' : 'No time data' // Show status if no time points
            )}
          </div>
        </div>

        {/* Time Slider */}
        <input
          type="range"
          min="0"
          max={Math.max(0, timePoints.length - 1)} // Slider range based on time points
          value={currentTimeIndex} // Controlled input value
          onChange={handleSliderChange} // Update state on change
          onMouseUp={handleSliderFinish} // Optional: handle mouse up
          onTouchEnd={handleSliderFinish} // Optional: handle touch end
          disabled={isLoading || timePoints.length <= 1} // Disable if loading or insufficient data
          className="w-full mt-4 accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 px-2"
          aria-valuetext={`Time point: ${currentTimePoint}`} // Accessibility: announce value
          aria-label="Time Point Slider" // Accessibility: label the control
        />
      </div>

      {/* --- Interpretation Guide --- */}
      <div className="border-t pt-4 mt-6">
        <h3 className="font-bold mb-2 text-lg text-blue-800">Interpretation Guide</h3>
        <div className="bg-blue-50 p-4 rounded-lg">
          <ul className="list-disc pl-5 text-gray-700 space-y-1 text-sm">
            <li>Heatmap shows interpolated density (darker blue = higher g/cm³).</li>
            <li>Circles are sampling stations; color matches legend if data exists. Grey if no data.</li>
            <li>Use slider or play button to view monthly changes.</li>
            <li>Observe potential correlations between temperature (Avg Temp) and density patterns.</li>
            <li>Data: GSL Brine Chemistry Database via API. Interpolation fills visual gaps.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GreatSaltLakeHeatmap; // Export the component

