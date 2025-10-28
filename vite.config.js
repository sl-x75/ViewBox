import { defineConfig } from 'vite'
import path from 'path'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  root: path.resolve(__dirname, 'src'),
  base: './', // Relative paths for both dev and production
  
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // Ensure assets are copied correctly
    assetsDir: 'assets',
  },
  
  // Optimize dependency handling
  optimizeDeps: {
    exclude: ['electron', 'source-map-js'],
    // Pre-bundle these heavy dependencies to speed up dev server
    include: [
      'web-ifc',
      'codemirror',
      '@codemirror/view',
      '@codemirror/state',
      'lodash',
      'interactjs'
    ]
  },
  
  plugins: [
    electron([
      // Main process
      {
        entry: path.resolve(__dirname, 'main.js'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron'),
            emptyOutDir: true,
            rollupOptions: {
              external: ['electron', 'chokidar', 'mime']
            }
          },
        },
      },
      // Preload script
      {
        entry: path.resolve(__dirname, 'preload.js'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron'),
            emptyOutDir: false, // Don't clear main.js
            rollupOptions: {
              external: ['electron']
            }
          },
        },
        onstart(options) {
          // Reload the renderer when preload changes
          options.reload();
        },
      },
    ]),
    renderer(),
  ],
  
  // Server config for development
  server: {
    port: 5173,
    strictPort: true,
  },
})