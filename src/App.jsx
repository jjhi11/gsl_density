import React from 'react'
import './App.css'
import GreatSaltLakeHeatmap from './components/GreatSaltLakeHeatmap';

function App() {
  return (
    <div className="App bg-white min-h-screen">
      {/* Removed the header with "Great Salt Lake Visualization" title */}
      <main className="container mx-auto px-4 pt-6">
        <GreatSaltLakeHeatmap />
      </main>
    </div>
  )
}

export default App