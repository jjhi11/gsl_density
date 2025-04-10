// Legend.jsx
import * as d3 from 'd3';

/**
 * Component for rendering the color scale legend
 * Note: This is a function, not a React component, as it directly manipulates the D3 selection
 */
// ++ Updated props: range and label are now generic ++
const Legend = ({ svg, colorScale, range, label, width, height }) => {
  // Add a semi-transparent background
  svg.append("rect")
    .attr("x", -5)
    .attr("y", -20)
    .attr("width", width + 10)
    .attr("height", height + 40)
    .attr("fill", "rgba(255, 255, 255, 0.8)");

  // ++ Legend title - use dynamic label prop ++
  svg.append("text")
    .attr("x", 0)
    .attr("y", -5)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text(label); // Use the passed label prop

  // ++ Create scale and axis using the passed 'range' prop ++
  const legendScale = d3.scaleLinear()
    .domain(range) // Use dynamic range
    .range([0, width]);

  // ++ Consider making tick format dynamic based on variable's precision if needed ++
  const legendAxis = d3.axisBottom(legendScale)
    .ticks(5) // Request 5 ticks, D3 might adjust
    .tickFormat(d3.format(".2f")); // Format numbers (e.g., 1.15, 120.50) - adjust if needed

  // Create gradient definition
  const defs = svg.append("defs");

  const gradient = defs.append("linearGradient")
    .attr("id", "variable-gradient") // Use a generic ID
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  // Add color stops using 'range'
  const numStops = 10;
  for (let i = 0; i <= numStops; i++) {
    const t = i / numStops;
    // Ensure range is valid before calculation
    const minValue = Array.isArray(range) && range.length > 0 && typeof range[0] === 'number' ? range[0] : 0;
    const maxValue = Array.isArray(range) && range.length > 1 && typeof range[1] === 'number' ? range[1] : 1;
    const value = minValue + (maxValue - minValue) * t;

    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorScale(value)); // colorScale is already dynamic via props
  }

  // Draw the color bar
  svg.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .style("fill", "url(#variable-gradient)"); // Use gradient ID

  // Draw the axis
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(legendAxis)
    .select(".domain")
    .remove(); // Remove the axis line itself
};

export default Legend;
