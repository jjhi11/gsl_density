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
  timePoints,
  currentTimePoint,
  densityData,
  temperatureData,
  densityRange,
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

  // Format the date properly (month name and year)
  const formatDateForTitle = (timePoint) => {
    if (!timePoint) return '';
    
    const [year, monthNum] = timePoint.split('-');
    const monthIndex = parseInt(monthNum) - 1;
    
    // Use month names
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return `${monthNames[monthIndex]} - ${year}`;
  };

  // Main rendering function for the heatmap
  const renderHeatmap = useCallback(() => {
    // Prerequisites check
    if (!svgRef.current || !lakeData || !projection || !stations) {
      console.log("Missing prerequisite for rendering:", {
        svg: !!svgRef.current,
        lakeData: !!lakeData,
        projection: !!projection,
        stations: !!stations
      });
      return;
    }
    
    console.log("Rendering heatmap with data:", {
      timePointsLength: timePoints.length,
      stationsLength: stations.length,
      currentTimePoint
    });
    
    // Handle empty stations
    if (stations.length === 0 && !isLoading) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      svg.append("text")
         .attr("x", MAP_WIDTH / 2)
         .attr("y", MAP_HEIGHT / 2)
         .attr("text-anchor", "middle")
         .attr("fill", "#aaa")
         .text("No station data loaded.");
      return;
    }

    // Main rendering logic
    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      // Get current data
      const currentTemp = temperatureData[currentTimePoint];
      const currentDensityMap = densityData[currentTimePoint] || {};
      const avgDensity = calculateAverageDensity(currentDensityMap);

      // Create canvas for heatmap
      const canvas = document.createElement('canvas');
      canvas.width = MAP_WIDTH;
      canvas.height = MAP_HEIGHT;
      const ctx = canvas.getContext('2d');

      // Define path generator
      const path = d3.geoPath().projection(projection);

      // Draw lake boundary and create clip path
      try {
        // Add a blue background
        svg.append("rect")
           .attr("width", MAP_WIDTH)
           .attr("height", MAP_HEIGHT)
           .attr("fill", "#f0f7fa");
           
        svg.append("defs")
           .append("clipPath")
           .attr("id", "lake-clip")
           .append("path")
           .datum(lakeData)
           .attr("d", path);

        // Draw the lake outline
        svg.append("path")
          .datum(lakeData)
          .attr("d", path)
          .attr("fill", "#e6f2f9")
          .attr("stroke", "#2b8cbe")
          .attr("stroke-width", 1.5)
          .attr("vector-effect", "non-scaling-stroke");

      } catch (pathError) {
        console.error("Error rendering lake boundary:", pathError);
        // Fallback rendering in case of error
        svg.append("defs")
           .append("clipPath")
           .attr("id", "lake-clip")
           .append("rect")
           .attr("x", 0).attr("y", 0)
           .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT);
        
        svg.append("rect")
           .attr("x", 0).attr("y", 0)
           .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT)
           .attr("fill", "none").attr("stroke", "#ff0000").attr("stroke-width", 2);
        
        svg.append("text")
           .attr("x", 10).attr("y", 20)
           .text("Error: Lake boundary failed")
           .attr("fill", "red");
           
        return;
      }

      // Create color scale
      const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([densityRange[1], densityRange[0]]);

      // Prepare data points for interpolation
      const dataPoints = stations.map(station => {
        const density = currentDensityMap[station.id];
        
        if (density !== undefined && density !== null && 
            !isNaN(station.longitude) && !isNaN(station.latitude)) {
          try {
            const projected = projection([station.longitude, station.latitude]);
            
            if (projected && !isNaN(projected[0]) && !isNaN(projected[1])) {
              return { x: projected[0], y: projected[1], value: density };
            }
          } catch (e) { 
            // Ignore projection errors
            console.debug(`Projection error for station ${station.id}`);
          }
        }
        return null;
      }).filter(p => p !== null);
      
      console.log(`Data points for interpolation: ${dataPoints.length}`);

      // Generate heatmap using IDW
      if (dataPoints.length > 0) {
        const cellSize = 5;
        const gridCols = Math.ceil(MAP_WIDTH / cellSize);
        const gridRows = Math.ceil(MAP_HEIGHT / cellSize);

        // IDW function
        const idw = (x, y, points, power = 2) => {
          let numerator = 0;
          let denominator = 0;
          let exactMatchValue = null;

          points.forEach(point => {
            const distanceSq = Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2);
            
            if (distanceSq === 0) { 
              exactMatchValue = point.value; 
              return; 
            }

            const weight = 1 / Math.pow(distanceSq, power / 2);
            numerator += point.value * weight;
            denominator += weight;
          });

          if (exactMatchValue !== null) return exactMatchValue;
          return denominator === 0 ? null : numerator / denominator;
        };

        // Draw the grid cells
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
            } catch {
              // Just continue on error - no need to log these
              continue;
            }
          }
        }
        
        console.log(`Drew ${cellsDrawn} cells on the heatmap canvas`);

        // Apply the heatmap to the SVG with clipping
        svg.append("g")
           .attr("clip-path", "url(#lake-clip)")
           .append("image")
           .attr("x", 0).attr("y", 0)
           .attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT)
           .attr("preserveAspectRatio", "none")
           .attr("href", canvas.toDataURL());

      } else {
        // Show message when no data is available
        svg.append("text")
           .attr("x", MAP_WIDTH / 2).attr("y", MAP_HEIGHT / 2)
           .attr("text-anchor", "middle").attr("fill", "#aaa")
           .text("No density data available for heatmap this month");
      }

// Draw stations
const stationGroup = svg.append("g").attr("class", "stations");

stations.forEach(station => {
  if (isNaN(station.longitude) || isNaN(station.latitude)) return;

  try {
    const projected = projection([station.longitude, station.latitude]);
    if (!projected || isNaN(projected[0]) || isNaN(projected[1])) return;

    const [x, y] = projected;
    const density = currentDensityMap[station.id];
    const hasData = density !== undefined && density !== null;
    const fillColor = hasData ? colorScale(density) : "#ccc";

    // Create station group
    const g = stationGroup.append("g").attr("transform", `translate(${x}, ${y})`);

    // Draw circle
    g.append("circle")
     .attr("r", 5)
     .attr("fill", fillColor)
     .attr("stroke", "#333")
     .attr("stroke-width", 1);

    // Add tooltip
    const tooltipText = hasData
      ? `${station.name}: ${density.toFixed(3)} g/cm³`
      : `${station.name}: No data`;

    g.append("title").text(tooltipText);

    // --- Start of label adjustments ---
    let labelX = 0;  // Default horizontal offset
    let labelY = 15; // Default vertical offset (below circle)

    // Specific adjustments for overlapping labels
    if (station.id === 'SJ-1') {
        labelX = -2; // Nudge SJ-1 slightly left
        labelY = 18; // Move slightly further down
    } else if (station.id === 'RD1') {
        labelX = 8;  // Nudge RD1 slightly right
        labelY = -10; // Move slightly further down
    }
    // Add more 'else if' conditions here for other overlaps if needed

    // Add the station label with updated styles and positions
    g.append("text")
     .attr("x", labelX) // Use calculated horizontal offset
     .attr("y", labelY) // Use calculated vertical offset
     .attr("text-anchor", "middle")
     .style("font-size", "10px")
     .style("font-family", "sans-serif") // Set sans-serif font
     .style("fill", "#333")
     .text(station.name);
     // --- End of label adjustments ---

  } catch (e) {
    console.debug(`Error drawing station ${station.id}`);
  }
});

      // Add legend (Moved to separate component)
      const legendArea = svg.append("g").attr("transform", `translate(${MAP_WIDTH - 230}, ${MAP_HEIGHT - 50})`);
      
      // Add title & info text with updated date format
      svg.append("text")
        .attr("x", MAP_WIDTH / 2).attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "16px").style("font-weight", "bold")
        .text(`Great Salt Lake Density - ${formatDateForTitle(currentTimePoint)}`);
        
      svg.append("text")
        .attr("x", MAP_WIDTH / 2).attr("y", 50)
        .attr("text-anchor", "middle").style("font-size", "12px")
        .text(`Avg Temp: ${currentTemp ? currentTemp.toFixed(1) + '°F' : 'N/A'} | Avg Density: ${avgDensity ? avgDensity.toFixed(3) + ' g/cm³' : 'N/A'}`);

      // Render the legend in the legendArea
      const legendWidth = 200;
      const legendHeight = 10;
      Legend({ 
        svg: legendArea, 
        colorScale,
        densityRange,
        width: legendWidth,
        height: legendHeight
      });

    } catch (renderErr) {
      console.error("Error during heatmap rendering:", renderErr);
      
      const svg = d3.select(svgRef.current);
      if (svg) {
        svg.selectAll("*").remove();
        svg.append("text")
           .attr("x", MAP_WIDTH/2)
           .attr("y", MAP_HEIGHT/2)
           .attr("text-anchor", "middle")
           .attr("fill", "red")
           .text("Error rendering visualization.");
      }
    }
  }, [lakeData, stations, projection, currentTimePoint, temperatureData, densityData, densityRange, isLoading, timePoints.length]);

  // Effect to trigger rendering when dependencies change
  useEffect(() => {
    if (projection && !isLoading && lakeData && timePoints.length > 0) {
      const animationId = requestAnimationFrame(() => {
        renderHeatmap();
      });
      
      return () => cancelAnimationFrame(animationId);
    }
  }, [currentTimePoint, isLoading, lakeData, timePoints.length, projection, renderHeatmap]);

  // SVG container component
  return (
    <div className="relative border rounded-lg bg-gray-100 overflow-hidden mb-4 shadow aspect-w-16 aspect-h-10 sm:aspect-h-9">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute top-0 left-0 w-full h-full block"
        style={{ backgroundColor: "#f0f7fa" }}
      />
    </div>
  );
};

export default HeatmapRenderer;