import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lambpilot.app",
  appName: "L.A.M.B",
  webDir: "dist/client",
  bundledWebRuntime: false,
  server: {
    hostname: "localhost",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "never",
  },
};

export default config;
