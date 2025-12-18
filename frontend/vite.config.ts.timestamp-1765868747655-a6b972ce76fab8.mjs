// vite.config.ts
import { defineConfig } from "file:///H:/cama%C3%B1a%20astra%20online/source/astracampaign/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///H:/cama%C3%B1a%20astra%20online/source/astracampaign/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  esbuild: false,
  server: {
    port: 3006,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash].[ext]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJIOlxcXFxjYW1hXHUwMEYxYSBhc3RyYSBvbmxpbmVcXFxcc291cmNlXFxcXGFzdHJhY2FtcGFpZ25cXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkg6XFxcXGNhbWFcdTAwRjFhIGFzdHJhIG9ubGluZVxcXFxzb3VyY2VcXFxcYXN0cmFjYW1wYWlnblxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vSDovY2FtYSVDMyVCMWElMjBhc3RyYSUyMG9ubGluZS9zb3VyY2UvYXN0cmFjYW1wYWlnbi9mcm9udGVuZC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gIGVzYnVpbGQ6IGZhbHNlLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcG9ydDogMzAwNixcclxuICAgIGhvc3Q6IHRydWUsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDMnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uW2V4dF0nLFxyXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnLFxyXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn0pIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpVyxTQUFTLG9CQUFvQjtBQUM5WCxPQUFPLFdBQVc7QUFFbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFNBQVM7QUFBQSxFQUNULFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGdCQUFnQjtBQUFBLFFBQ2hCLGdCQUFnQjtBQUFBLFFBQ2hCLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
