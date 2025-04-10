import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/gsl_density',
  build: {
    outDir: 'dist', // This defines the output directory for the build
    emptyOutDir: true // This clears the directory before building
  }
})
