import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.copamundial2026.picks",
  appName: "Mundial 2026",
  webDir: "native-www",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
      }
    : undefined,
  plugins: {
    SplashScreen: {
      backgroundColor: "#0a0d12",
      showSpinner: false,
    },
  },
};

export default config;
