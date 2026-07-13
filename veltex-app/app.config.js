export default {
  expo: {
    name: "VELTEX",
    slug: "veltex",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    icon: "./assets/icon.png",
    splash: {
      backgroundColor: "#1B1225",
    },
    ios: {
      bundleIdentifier: "com.yourcompany.veltex",
      supportsTablet: false,
    },
    android: {
      package: "com.yourcompany.veltex",
    },
    extra: {
      // Public API base URL for your deployed backend from step 1.
      apiBaseUrl: process.env.VELTEX_API_BASE_URL || "http://localhost:4000",
    },
    plugins: [
      [
        "react-native-google-mobile-ads",
        {
          // Real AdMob APP IDs (not ad unit IDs) from AdMob console:
          // Apps > your app > App settings > App ID
          androidAppId: process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-3554681097005105~7100012381",
          iosAppId: process.env.ADMOB_IOS_APP_ID || "ca-app-pub-XXXXXXXXXXXXXXXX~ZZZZZZZZZZ",
        },
      ],
    ],
  },
};
