import * as d3 from 'd3';

/**
 * Component for rendering the color scale legend
 * Note: This is a function, not a React component, as it directly manipulates the D3 selection
 */
const Legend = ({ svg, colorScale, densityRange, width, height }) => {
  // Add a semi-transparent background
  svg.append("rect")
    .attr("x", -5)
    .attr("y", -20)
    .attr("width", width + 10)
    .attr("height", height + 40)
    .attr("fill", "rgba(255, 255, 255, 0.8)");

  // Legend title
  svg.append("text")
    .attr("x", 0)
    .attr("y", -5)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text("Density (g/cm³)");

  // Create scale and axis
  const legendScale = d3.scaleLinear()
    .domain(densityRange)
    .range([0, width]);
    
  const legendAxis = d3.axisBottom(legendScale)
    .ticks(5)
    .tickFormat(d3.format(".2f"));

  // Create gradient definition
  const defs = svg.append("defs");
  
  const gradient = defs.append("linearGradient")
    .attr("id", "density-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  // Add color stops
  const numStops = 10;
  for (let i = 0; i <= numStops; i++) {
    const t = i / numStops;
    const value = densityRange[0] + (densityRange[1] - densityRange[0]) * t;
    
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorScale(value));
  }

  // Draw the color bar
  svg.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .style("fill", "url(#density-gradient)");

  // Draw the axis
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(legendAxis)
    .select(".domain")
    .remove();
};

export default Legend;
