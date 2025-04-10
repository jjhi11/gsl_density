// HeatmapRenderer.jsx
import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import Legend from './Legend';
import { calculateAverageDensity } from './utils';

// Constants
const MAP_WIDTH = 800;
const MAP_HEIGHT = 500;

/**
 * Component responsible for rendering the D3 heatmap visualization
 */
const HeatmapRenderer = ({
  lakeData,
  stations,
  // Receive generic props
  currentDataForTimepoint,
  currentTemperature,
  currentRange,
  currentConfig, // Contains { key, label, unit, precision, interpolate, defaultRange }
  currentTimePoint,
  isLoading
}) => {
  const svgRef = useRef(null);

  // Create the D3 projection based on the lake data
  const projection = useMemo(() => {
    if (!lakeData) return null;
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
    if (!svgRef.current || !lakeData || !projection || !stations || !currentConfig) {
        console.log("HeatmapRenderer prerequisites not met - skipping render.");
        return;
    }

    console.log(`Rendering heatmap for: ${currentConfig.label} - ${currentTimePoint}`);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Get current data average
    const avgValue = calculateAverageDensity(currentDataForTimepoint);

    // Create canvas for heatmap rendering
    const canvas = document.createElement('canvas');
    canvas.width = MAP_WIDTH;
    canvas.height = MAP_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Define path generator
    const path = d3.geoPath().projection(projection);

    // --- 1. Define Clip Path using Lake Outline ---
    try {
        svg.append("defs")
           .append("clipPath")
           .attr("id", "lake-clip") // Unique ID for the clip path
           .append("path")
           .datum(lakeData)
           .attr("d", path);
    } catch (pathError) {
        console.error("Error creating clip path from lake boundary:", pathError);
        // Optionally draw a fallback rectangle clip path
        svg.append("defs")
           .append("clipPath")
           .attr("id", "lake-clip")
           .append("rect")
           .attr("x", 0).attr("y", 0)
           .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT);
        svg.append("text") // Add error message to SVG
           .attr("x", 10).attr("y", 20)
           .text("Error: Failed to create lake clip path.")
           .attr("fill", "red");
    }
    // --- End Clip Path Definition ---


    // --- 2. Create Color Scale ---
    const colorInterpolatorName = currentConfig.interpolate || 'interpolateBlues';
    const colorInterpolator = d3[colorInterpolatorName] || d3.interpolateBlues;
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([currentRange[1], currentRange[0]]); // Reversed for Blues, Greens etc.


    // --- 3. Prepare Data Points ---
    const dataPoints = stations.map(station => {
      const value = currentDataForTimepoint[station.id];
      if (value !== undefined && value !== null && !isNaN(station.longitude) && !isNaN(station.latitude)) {
        try {
          const projected = projection([station.longitude, station.latitude]);
          if (projected && !isNaN(projected[0]) && !isNaN(projected[1])) {
            return { x: projected[0], y: projected[1], value: value };
          }
        } catch (e) { console.debug(`Projection error for station ${station.id}`); }
      }
      return null;
    }).filter(p => p !== null);


    // --- 4. Generate Heatmap on Canvas (using IDW) ---
    if (dataPoints.length > 0) {
      const cellSize = 5; // Adjust for resolution vs performance
      const gridCols = Math.ceil(MAP_WIDTH / cellSize);
      const gridRows = Math.ceil(MAP_HEIGHT / cellSize);

      // Inverse Distance Weighting function
      const idw = (x, y, points, power = 2) => {
        let numerator = 0;
        let denominator = 0;
        let exactMatchValue = null;
        points.forEach(point => {
          const distanceSq = Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2);
          if (distanceSq === 0) { exactMatchValue = point.value; return; }
          const weight = 1 / Math.pow(distanceSq, power / 2);
          numerator += point.value * weight;
          denominator += weight;
        });
        if (exactMatchValue !== null) return exactMatchValue;
        return denominator === 0 ? null : numerator / denominator;
      };

      // Fill canvas grid cells
      let cellsDrawn = 0;
      for (let col = 0; col < gridCols; col++) {
        for (let row = 0; row < gridRows; row++) {
          const cellX = col * cellSize + cellSize / 2;
          const cellY = row * cellSize + cellSize / 2;
          try {
            const interpolatedValue = idw(cellX, cellY, dataPoints);
            if (interpolatedValue !== null) {
              ctx.fillStyle = colorScale(interpolatedValue);
              ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
              cellsDrawn++;
            }
          } catch { continue; }
        }
      }
       console.log(`Drew ${cellsDrawn} cells on the heatmap canvas.`);

      // --- 5. Render Heatmap Canvas as SVG Image with Clipping ---
      svg.append("image")
         .attr("x", 0)
         .attr("y", 0)
         .attr("width", MAP_WIDTH)
         .attr("height", MAP_HEIGHT)
         .attr("preserveAspectRatio", "none")
         .attr("clip-path", "url(#lake-clip)") // Apply the clip path
         .attr("href", canvas.toDataURL());

    } else {
      // Show message if no data points for interpolation
      svg.append("text")
         .attr("x", MAP_WIDTH / 2).attr("y", MAP_HEIGHT / 2)
         .attr("text-anchor", "middle").attr("fill", "#aaa")
         .text(`No ${currentConfig.label || 'data'} available for heatmap interpolation this month`);
    }
    // --- End Heatmap Rendering ---


    // --- 6. Draw Stations (On Top) ---
    const stationGroup = svg.append("g").attr("class", "stations");
    stations.forEach(station => {
      if (isNaN(station.longitude) || isNaN(station.latitude)) return;
      try {
        const projected = projection([station.longitude, station.latitude]);
        if (!projected || isNaN(projected[0]) || isNaN(projected[1])) return;

        const [x, y] = projected;
        const value = currentDataForTimepoint[station.id];
        const hasData = value !== undefined && value !== null;
        const fillColor = hasData ? colorScale(value) : "#ccc"; // Color point by same scale

        const g = stationGroup.append("g").attr("transform", `translate(${x}, ${y})`);
        g.append("circle")
         .attr("r", 5)
         .attr("fill", fillColor)
         .attr("stroke", "#333")
         .attr("stroke-width", 1);

        const tooltipText = hasData
          ? `${station.name}: ${value.toFixed(currentConfig.precision)} ${currentConfig.unit}`
          : `${station.name}: No data`;
        g.append("title").text(tooltipText);

        let labelX = 0; let labelY = 15;
        if (station.id === 'SJ-1') { labelX = -8; labelY = 18; }
        else if (station.id === 'RD1') { labelX = 8; labelY = 18; }

        g.append("text")
         .attr("x", labelX).attr("y", labelY)
         .attr("text-anchor", "middle")
         .style("font-size", "10px").style("font-family", "sans-serif").style("fill", "#333")
         .text(station.name);

      } catch (e) { console.debug(`Error drawing station ${station.id}`); }
    });
    // --- End Stations ---


    // --- 7. Add Title, Info Text, and Legend (On Top) ---
    svg.append("text") // Title
      .attr("x", MAP_WIDTH / 2).attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "16px").style("font-weight", "bold")
      .text(`Great Salt Lake ${currentConfig.label} - ${formatDateForTitle(currentTimePoint)}`);

    svg.append("text") // Info text
      .attr("x", MAP_WIDTH / 2).attr("y", 50)
      .attr("text-anchor", "middle").style("font-size", "12px")
      .text(`Avg Temp: ${currentTemperature ? currentTemperature.toFixed(1) + '°F' : 'N/A'} | Avg ${currentConfig.label}: ${avgValue ? avgValue.toFixed(currentConfig.precision) + ` ${currentConfig.unit}` : 'N/A'}`);

    // Legend
    const legendArea = svg.append("g").attr("transform", `translate(${MAP_WIDTH - 230}, ${MAP_HEIGHT - 50})`);
    Legend({
      svg: legendArea,
      colorScale,
      range: currentRange,
      label: `${currentConfig.label} (${currentConfig.unit})`,
      width: 200,
      height: 10
    });
    // --- End Title/Info/Legend ---

  }, [
       lakeData, stations, projection, currentTimePoint, currentDataForTimepoint,
       currentTemperature, currentRange, currentConfig, isLoading, formatDateForTitle // Keep dependencies updated
  ]);

  // Effect to trigger rendering
  useEffect(() => {
    if (projection && !isLoading && lakeData && currentConfig) {
      const animationId = requestAnimationFrame(() => { renderHeatmap(); });
      return () => cancelAnimationFrame(animationId);
    }
     // Add lakeData as dependency
  }, [currentTimePoint, isLoading, lakeData, projection, renderHeatmap, currentConfig]);

  // SVG container
  return (
    <div className="relative border rounded-lg bg-gray-100 overflow-hidden mb-4 shadow aspect-w-16 aspect-h-10 sm:aspect-h-9">
      {/* The SVG background color is set here, or defaults */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute top-0 left-0 w-full h-full block"
        style={{ backgroundColor: "#f0f7fa" }} // Optional light blue background for area outside lake clip
      />
    </div>
  );
};

export default HeatmapRenderer;