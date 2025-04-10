# Great Salt Lake Conditions Heatmap (gsl_density)

This project displays a time-series visualization of chemical conditions (like density and salinity) in the Great Salt Lake using an interactive heatmap and station markers. It's built with React, Vite, and D3.js.

**Live Demo:** [Link to your GitHub Pages site] *(Replace this with your actual deployed URL)*

## Features

* **Interactive Map:** Displays a geographic outline of the Great Salt Lake (North and South Arms).
* **Heatmap Visualization:** Shows interpolated values for selected water chemistry parameters across the lake surface, calculated separately for the North and South Arms.
* **Station Data:** Plots monitoring station locations with color-coded markers based on the selected variable's value for the current time point. Tooltips show exact values.
* **Variable Selection:** Dropdown menu allows switching the displayed heatmap between different variables (currently Density and Salinity EOS).
* **Time Series Controls:**
    * Slider to manually select month and year (2000-2025).
    * Play/Pause button to animate the visualization over time.
    * Displays the currently selected date, average lake temperature (if available), and average value for the selected variable.
* **Dynamic Legend:** A color legend updates based on the selected variable and its data range for the current time series.
* **Station Labels:** Displays station names near the markers, with basic collision avoidance for specific overlapping labels (SJ-1, RD1).
* **Data Handling:**
    * Fetches station data and readings from a PostgREST API.
    * Uses hardcoded historical temperature data as a primary source or fallback.
    * Fetches the GSL outline (split North/South arms) from the UGS GeoServer WFS.
    * Includes fallback mechanisms using simplified GeoJSON and mock/simulated data generation if API calls fail or return insufficient data.
* **Interpretation Guide:** Provides context on how to read the heatmap and markers.

## Technology Stack

* **Framework/Library:** React 19
* **Build Tool:** Vite
* **Visualization:** D3.js (v7)
* **Coordinate Projection:** proj4js
* **Deployment:** GitHub Pages (via `gh-pages` package)

## Data Sources

* **Lake Outline:** Utah Geological Survey (UGS) GeoServer WFS - `gen_gis:gsl_outline_split` layer.
    * URL: `https://ugs-geoserver-prod-flbcoqv7oa-uc.a.run.app/geoserver/gen_gis/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=gen_gis%3Agsl_outline_split&maxFeatures=50&outputFormat=application%2Fjson`
* **Station & Reading Data:** Seamless Geology Map PostgREST API - `gsl_brine_sites` endpoint.
    * URL: `https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app/gsl_brine_sites`
* **Temperature Data:** Hardcoded historical data (originally from `Great Salt Lake Temperature Data (2000-2025).txt`) processed in `src/components/GreatSaltLakeHeatmap/TemperatureData.js`.
* **Mock/Simulated Data:** Generated within `src/components/GreatSaltLakeHeatmap/DataLoader.js` if primary sources fail or provide insufficient data points.

## Setup and Running Locally

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/jjhi11/gsl_density.git](https://github.com/jjhi11/gsl_density.git)
    cd gsl_density
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start the Vite development server, usually available at `http://localhost:5173` (or the next available port).

## Deployment

This project uses the `gh-pages` package to deploy the built application to the `gh-pages` branch, which can be served using GitHub Pages.

1.  **Build the project:**
    ```bash
    npm run build
    ```
    This creates the static files in the `dist` directory.
2.  **Deploy to GitHub Pages:**
    ```bash
    npm run deploy
    ```
    This command (defined in `package.json`) pushes the contents of the `dist` folder to the `gh-pages` branch on your GitHub repository. Ensure your GitHub Pages settings are configured to deploy from the `gh-pages` branch.