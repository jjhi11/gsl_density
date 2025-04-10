import React from 'react'
import './App.css'
import GreatSaltLakeHeatmap from './components/GreatSaltLakeHeatmap.jsx'

function App() {
  return (
    <div className="App bg-white min-h-screen">
      <header className="App-header bg-blue-700 text-white py-4 mb-6 shadow-md">
        <h1 className="text-2xl font-bold">Great Salt Lake Visualization</h1>
      </header>
      <main className="container mx-auto px-4">
        <GreatSaltLakeHeatmap />
      </main>
    </div>
  )
}

export default App