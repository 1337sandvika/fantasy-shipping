import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Fantasy Shipping — iOS App Store wrapper.
 *
 * Bundle ID: com.fantasyshipping.app
 * Display name: Fantasy Shipping
 *
 * webDir is the local Vite/TanStack SPA output (see `npm run build:ios`).
 * Do NOT set `server.url` to the grok.me site — Apple Guideline 4.2 rejects
 * thin remote-WebView wrappers. The game assets ship in the binary; only
 * auth / scoreboard / leagues call the hosted API.
 */
const config: CapacitorConfig = {
  appId: "com.fantasyshipping.app",
  appName: "Fantasy Shipping",
  webDir: "www",
  server: {
    iosScheme: "capacitor",
    androidScheme: "https",
    hostname: "localhost",
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#071018",
    scheme: "Fantasy Shipping",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#071018",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#071018",
    },
  },
};

export default config;
