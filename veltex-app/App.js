import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import mobileAds from "react-native-google-mobile-ads";
import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation";

export default function App() {
  useEffect(() => {
    mobileAds().initialize();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
