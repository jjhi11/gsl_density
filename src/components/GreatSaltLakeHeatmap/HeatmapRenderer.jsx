// HeatmapRenderer.jsx
import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import Legend from './Legend';
import { calculateAverageDensity } from './utils';
import InteractiveStationMarker from './InteractiveStationMarker'; // Import new component

// Constants
const MAP_WIDTH = 800;
const MAP_HEIGHT = 500;

/**
 * Component responsible for rendering the D3 heatmap visualization
 */
const HeatmapRenderer = ({
  lakeData, // Now potentially a FeatureCollection with multiple features
  stations,
  // Receive generic props
  currentDataForTimepoint,
  currentTemperature,
  currentRange,
  currentConfig, // Contains { key, label, unit, precision, interpolate, defaultRange }
  currentTimePoint,
  isLoading,
  onStationClick,
  hideTitle = false // New prop for comparison view
}) => {
  const svgRef = useRef(null);
  const [stationData, setStationData] = useState([]);

  // Projection uses the whole FeatureCollection bounds
  const projection = useMemo(() => {
    // Add check for features array existence
    if (!lakeData || !lakeData.features || lakeData.features.length === 0) {
        console.warn("Lake data is missing or has no features for projection.");
        return null;
    }
    try {
      return d3.geoMercator()
        .fitExtent([[20, 20], [MAP_WIDTH - 20, MAP_HEIGHT - 20]], lakeData);
    } catch (err) {
      console.error("Error creating projection:", err);
      return null;
    }
  }, [lakeData]);

  // Format date properly (month name and year)
  const formatDateForTitle = useCallback((timePoint) => {
    if (!timePoint) return '';
    const [year, monthNum] = timePoint.split('-');
    const monthIndex = parseInt(monthNum) - 1;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[monthIndex] || ''} - ${year}`;
  }, []);

  // Main rendering function for the heatmap
  const renderHeatmap = useCallback(() => {
    // Prerequisites check
    if (!svgRef.current || !lakeData || !lakeData.features || lakeData.features.length === 0 || !projection || !stations || !currentConfig) {
        console.log("HeatmapRenderer prerequisites not met - skipping render.");
        return;
    }

    console.log(`Rendering SEPARATE heatmaps for: ${currentConfig.label} - ${currentTimePoint}`);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Get current data average
    const avgValue = calculateAverageDensity(currentDataForTimepoint);
    const currentTemp = currentTemperature; // Use the correctly passed prop

    // --- Canvases for separate arms ---
    const northCanvas = document.createElement('canvas'); northCanvas.width = MAP_WIDTH; northCanvas.height = MAP_HEIGHT;
    const northCtx = northCanvas.getContext('2d');
    const southCanvas = document.createElement('canvas'); southCanvas.width = MAP_WIDTH; southCanvas.height = MAP_HEIGHT;
    const southCtx = southCanvas.getContext('2d');
    // ---

    const path = d3.geoPath().projection(projection);

    // --- 1. Define MULTIPLE Clip Paths and identify features ---
    const defs = svg.append("defs");
    const clipPaths = {}; // Store { clipId: featureName }
    let northClipId = null;
    let southClipId = null;

    lakeData.features.forEach((feature, index) => {
        // Create a unique ID based on name or index, ensure it's valid for CSS ID
        const name = (feature.properties?.name || `feature-${index}`)
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
                        .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
        const clipId = `lake-clip-${name || index}`; // Fallback to index if name becomes empty
        clipPaths[clipId] = name; // Store the cleaned name or index identifier

        // Identify North/South based on properties.name (case-insensitive)
        if (name.includes('north')) { // Simple check
            northClipId = clipId;
        } else if (name.includes('south')) { // Simple check
            southClipId = clipId;
        } else {
            console.warn(`Feature ${index} name "${name}" not identified as North or South.`);
            // Assign based on index as a fallback? Or ignore? For now, ignore for clipping heatmap.
        }

        try {
            defs.append("clipPath")
                .attr("id", clipId)
                .append("path")
                .datum(feature) // Use individual feature
                .attr("d", path);
        } catch (pathError) {
            console.error(`Error creating clip path for feature ${index} (${name}):`, pathError);
             defs.append("clipPath").attr("id", clipId).append("rect").attr("width", 0).attr("height", 0); // Empty fallback
        }
    });
    console.log("Generated clip path IDs:", clipPaths, { northClipId, southClipId });
    if (!northClipId || !southClipId) {
        console.error("Could not identify both North and South Arm clip paths! Heatmap clipping might fail.");
        // Consider adding a visual error/warning on the SVG itself
    }
    // --- End Clip Path Definition ---


    // --- 2. Create Color Scale with increased contrast for accessibility ---
    const colorInterpolatorName = currentConfig.interpolate || 'interpolateBlues';
    const colorInterpolator = d3[colorInterpolatorName] || d3.interpolateBlues;
    
    // Enhanced color scale with better contrast
    const colorScale = d3.scaleSequential()
      .domain([currentRange[1], currentRange[0]])
      .interpolator(t => {
        // Enhance contrast by adjusting the input to the interpolator
        const adjustedT = Math.pow(t, 1.2); // Increase contrast
        return colorInterpolator(adjustedT);
      });


    // --- 3. Prepare SEPARATE Data Points ---
    const northArmStationIds = ['RD2', 'SJ-1', 'RD1', 'LVG4']; // From user input
    const northDataPoints = [];
    const southDataPoints = [];

    stations.forEach(station => {
        const value = currentDataForTimepoint[station.id];
        // Check if value and coordinates are valid numbers
        if (value !== undefined && value !== null && typeof value === 'number' && !isNaN(value) &&
            !isNaN(station.longitude) && !isNaN(station.latitude)) {
            try {
                const projected = projection([station.longitude, station.latitude]);
                // Check if projection returned valid coordinates
                if (projected && !isNaN(projected[0]) && !isNaN(projected[1])) {
                    const point = { x: projected[0], y: projected[1], value: value };
                    if (northArmStationIds.includes(station.id)) {
                        northDataPoints.push(point);
                    } else { // Assume all others are south arm
                        southDataPoints.push(point);
                    }
                }
            } catch (e) { console.debug(`Projection error for station ${station.id}`); }
        }
    });
    console.log(`North Arm data points: ${northDataPoints.length}, South Arm data points: ${southDataPoints.length}`);
    // --- End Data Point Separation ---


    // --- 4. Generate Heatmap on SEPARATE Canvases ---
    const cellSize = 5; // Grid resolution
    const gridCols = Math.ceil(MAP_WIDTH / cellSize);
    const gridRows = Math.ceil(MAP_HEIGHT / cellSize);
    let northCellsDrawn = 0;
    let southCellsDrawn = 0;

    // Inverse Distance Weighting function
    const idw = (x, y, points, power = 2) => {
        let numerator = 0;
        let denominator = 0;
        let exactMatchValue = null;
        for (const point of points) { // Use for...of for potential early exit
            const distanceSq = Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2);
            if (distanceSq < 0.0001) { // Threshold for exact match
                exactMatchValue = point.value;
                break; // Found exact match, no need to check others
            }
            const weight = 1 / Math.pow(distanceSq, power / 2);
            numerator += point.value * weight;
            denominator += weight;
        }
        if (exactMatchValue !== null) return exactMatchValue;
        return denominator === 0 ? null : numerator / denominator;
    };

    // Only perform grid calculation if there are points in at least one arm
    if (northDataPoints.length > 0 || southDataPoints.length > 0) {
        for (let col = 0; col < gridCols; col++) {
            for (let row = 0; row < gridRows; row++) {
                const cellX = col * cellSize + cellSize / 2;
                const cellY = row * cellSize + cellSize / 2;

                // Interpolate for North Arm if points exist
                if (northDataPoints.length > 0) {
                    try {
                        const interpolatedNorth = idw(cellX, cellY, northDataPoints);
                        if (interpolatedNorth !== null) {
                            northCtx.fillStyle = colorScale(interpolatedNorth);
                            northCtx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                            northCellsDrawn++;
                    }
                } catch (e) { /* ignore interpolation errors */ }
            }

            // Interpolate for South Arm if points exist
            if (southDataPoints.length > 0) {
                try {
                    const interpolatedSouth = idw(cellX, cellY, southDataPoints);
                    if (interpolatedSouth !== null) {
                        southCtx.fillStyle = colorScale(interpolatedSouth);
                        southCtx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                        southCellsDrawn++;
                    }
                } catch (e) { /* ignore interpolation errors */ }
            }
        }
    }
}
console.log(`Drew ${northCellsDrawn} North cells, ${southCellsDrawn} South cells.`);
// --- End Canvas Generation ---


// --- 5. Render Heatmap Images with Clipping ---
const northCanvasHasData = northCellsDrawn > 0;
const southCanvasHasData = southCellsDrawn > 0;

// Render North Arm Image if data exists and clip path was found
if (northCanvasHasData && northClipId) {
    svg.append("image")
       .attr("x", 0).attr("y", 0)
       .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT)
       .attr("preserveAspectRatio", "none")
       .attr("clip-path", `url(#${northClipId})`)
       .attr("href", northCanvas.toDataURL());
}

// Render South Arm Image if data exists and clip path was found
if (southCanvasHasData && southClipId) {
     svg.append("image")
       .attr("x", 0).attr("y", 0)
       .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT)
       .attr("preserveAspectRatio", "none")
       .attr("clip-path", `url(#${southClipId})`)
       .attr("href", southCanvas.toDataURL());
}

// Display message if neither heatmap rendered data
if (!northCanvasHasData && !southCanvasHasData) {
     svg.append("text")
        .attr("x", MAP_WIDTH / 2).attr("y", MAP_HEIGHT / 2)
        .attr("text-anchor", "middle").attr("fill", "#aaa")
        .text(`No ${currentConfig.label || 'data'} available for heatmap this month`);
}
// --- End Heatmap Rendering ---


// --- Optional: Draw Outlines AFTER heatmap images ---
 svg.append("g")
    .attr("class", "lake-outlines")
    .selectAll("path")
    .data(lakeData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#66a9c9") // Outline color
    .attr("stroke-width", 1)
    .attr("vector-effect", "non-scaling-stroke");
// --- End Outlines ---


// --- 6. Collect Station Data for Interactive Markers ---
const stationDataArray = [];

stations.forEach(station => {
  if (isNaN(station.longitude) || isNaN(station.latitude)) return;
  try {
    const projected = projection([station.longitude, station.latitude]);
    if (!projected || isNaN(projected[0]) || isNaN(projected[1])) return;

    const value = currentDataForTimepoint[station.id];
    
    // Add to station data array for React component
    stationDataArray.push({
      station,
      projected,
      value,
      colorScale
    });
  } catch (e) { console.debug(`Error creating station data ${station.id}`); }
});

// Update state with station data for interactive markers
setStationData(stationDataArray);


// --- 7. Add Title, Info Text, and Legend (On Top) ---
if (!hideTitle) {
  svg.append("text") // Title
    .attr("x", MAP_WIDTH / 2).attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "16px").style("font-weight", "bold")
    .text(`Great Salt Lake ${currentConfig.label} - ${formatDateForTitle(currentTimePoint)}`);

  svg.append("text") // Info text
    .attr("x", MAP_WIDTH / 2).attr("y", 50)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text(`Avg Temp: ${currentTemperature ? currentTemperature.toFixed(1) + '°F' : 'N/A'} | Avg ${currentConfig.label}: ${avgValue ? avgValue.toFixed(currentConfig.precision) + ` ${currentConfig.unit}` : 'N/A'}`);
}

// Legend is always shown, even when title is hidden
const legendArea = svg.append("g").attr("transform", `translate(${MAP_WIDTH - 230}, ${hideTitle ? 20 : MAP_HEIGHT - 50})`);
Legend({
  svg: legendArea,
  colorScale,
  range: currentRange,
  label: `${currentConfig.label} (${currentConfig.unit})`,
  width: 200,
  height: 10
});
// --- End Title/Info/Legend ---
}, [ // Keep dependencies comprehensive
    lakeData, stations, projection, currentTimePoint, currentDataForTimepoint,
    currentTemperature, currentRange, currentConfig, isLoading, formatDateForTitle, onStationClick
]);

// Effect to trigger rendering
useEffect(() => {
 // Check all potentially changing dependencies that affect rendering
 if (projection && !isLoading && lakeData && currentConfig && stations) {
   const animationId = requestAnimationFrame(() => { renderHeatmap(); });
   return () => cancelAnimationFrame(animationId);
 }
}, [currentTimePoint, isLoading, lakeData, projection, renderHeatmap, currentConfig, stations]); // Include stations here


// SVG container with interactive station markers
return (
 <div className="relative border rounded-lg bg-gray-100 overflow-hidden mb-4 shadow aspect-w-16 aspect-h-10 sm:aspect-h-9">
   <svg
     ref={svgRef}
     viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
     preserveAspectRatio="xMidYMid meet"
     className="absolute top-0 left-0 w-full h-full block"
     style={{ backgroundColor: "#f0f7fa" }} // Base background if needed
   >
     {/* Interactive Station Markers rendered as React components */}
     {stationData.map((data, index) => (
       <InteractiveStationMarker
         key={index}
         station={data.station}
         value={data.value}git pull
         projected={data.projected}
         colorScale={data.colorScale}
         onClick={onStationClick}
         variableConfig={currentConfig}
       />
     ))}
   </svg>
 </div>
);
};

export default HeatmapRenderer;