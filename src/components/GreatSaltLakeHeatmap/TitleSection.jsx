

const TitleSection = () => {
    return (
      <div className="title-section mb-6">
        {/* Main title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2 text-blue-800">
          Great Salt Lake Monitoring Dashboard
        </h1>
        
        {/* Subtitle with temporal context */}
        <h2 className="text-xl sm:text-2xl font-medium text-center mb-4 text-blue-600">
          Density & Salinity Visualization (2000-2025)
        </h2>
        
        {/* Description that explains importance and content */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-3xl mx-auto">
          <p className="text-gray-800 mb-2">
            This interactive visualization tracks critical water quality parameters in the Great Salt Lake across 
            time and location, helping monitor the lake's health and ecological conditions.
          </p>
          <p className="text-gray-700 text-sm">
            <strong>LAB-DEN</strong>: Laboratory-measured density (g/cm³) - indicates dissolved salt concentration
            <span className="mx-2">|</span>
            <strong>Salinity EOS</strong>: Salt content in grams per liter (g/L) - affects aquatic ecosystem viability
          </p>
        </div>
        
        {/* Quick guide pills for user action */}
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
            <span className="font-bold">↔️</span> Use slider to navigate time
          </span>
          <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
            <span className="font-bold">🔄</span> Select between density/salinity data
          </span>
          <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
            <span className="font-bold">👆</span> Click stations for time series data
          </span>
        </div>
      </div>
    );
  };
  
  export default TitleSection;