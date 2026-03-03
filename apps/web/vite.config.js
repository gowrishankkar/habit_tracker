import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname shim
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),

    // Automatically splits node_modules into a separate vendor chunk.
    // This means app code changes don't bust the browser cache for React,
    // Redux, Recharts etc. — those are large and rarely change.
    splitVendorChunkPlugin(),

    VitePWA({
      // injectManifest: we own the SW file (src/sw.ts); VitePWA only injects
      // the precache manifest into it at build time. This lets us use native
      // Background Sync, custom conflict resolution, and per-route strategies.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      // 'prompt' — the app shows a banner asking the user to reload.
      // The SW's message listener handles SKIP_WAITING on confirmation.
      registerType: "prompt",

      includeAssets: ["favicon.ico", "icons/*.png"],

      manifest: {
        name: "Habit Tracker",
        short_name: "Habits",
        description: "Track your daily habits and build streaks",
        theme_color: "#3b82f6",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      injectManifest: {
        // The token Workbox replaces with the precache asset list
        injectionPoint: "self.__WB_MANIFEST",
        // Bundle the SW as IIFE — service workers don't support ES modules
        // in all browsers, and IIFE maximises compatibility.
        rollupFormat: "iife",
        // Precache all build output including fonts and icons
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },

      devOptions: {
        // Enable the SW in development so offline behaviour can be tested
        // with `vite dev`. The SW runs in module mode during dev.
        enabled: true,
        type: "module",
      },
    }),
  ],

  resolve: {
    // Resolve JavaScript/JSX before TypeScript/TSX — the .js/.jsx files are
    // now the authoritative versions. .ts/.tsx files without .js counterparts
    // (types.ts, sw.ts, etc.) are still found via fallthrough.
    extensions: [".js", ".jsx", ".mjs", ".ts", ".tsx", ".mts", ".json"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    proxy: {
      // During dev, forward /api requests to the Express server
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },

  build: {
    // Target modern browsers that support ES2020 + dynamic import.
    // Avoids polyfill bloat for features all target browsers support natively.
    target: "es2020",

    // Inline assets smaller than 4kb as base64 to save round-trips.
    // Larger assets (icons, fonts) remain as separate requests so they can be
    // cached independently.
    assetsInlineLimit: 4096,

    // Generate source maps in production for error monitoring services
    // (Sentry, Datadog). Set to false if bundle size is a priority.
    sourcemap: mode === "production" ? "hidden" : true,

    // Warn when any individual chunk exceeds 500 KB (gzipped estimate).
    // Recharts + React can easily exceed this — review the bundle if it fires.
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // Manual chunk splitting strategy:
        //
        // react-vendor  — React + ReactDOM (~140kb gz) — changes rarely
        // redux-vendor  — RTK + React-Redux — changes rarely
        // charts-vendor — Recharts (~80kb gz) — changes rarely
        // ui-vendor     — Radix / Headless UI / clsx etc.
        //
        // Splitting these out means a fix to the app JS (habitsSlice.js, etc.)
        // does NOT bust the cache for the 300kb+ library bundle.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/")) {
              return "react-vendor";
            }
            if (
              id.includes("@reduxjs") ||
              id.includes("react-redux") ||
              id.includes("redux")
            ) {
              return "redux-vendor";
            }
            if (id.includes("recharts") || id.includes("d3-")) {
              return "charts-vendor";
            }
          }
        },

        // Content-hash filenames for cache-busting.
        // /assets/[name]-[hash].js is the default; made explicit here
        // so nginx / CDN cache rules match predictably.
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },

    // Minify with esbuild (default in Vite 5) — fastest option, near-identical
    // output to terser for most codebases.
    minify: "esbuild",
  },
}));

