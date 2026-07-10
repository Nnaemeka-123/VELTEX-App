import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { RewardedAd, RewardedAdEventType, AdEventType } from "react-native-google-mobile-ads";
import { api } from "../api/client";

// Real AdMob ad unit ID goes in app.config.js / env, this just reads it at runtime.
const AD_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID || "ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY";

export default function RewardedAdCard({ sponsorLabel = "Sponsored", onRewardClaimed }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | watching | claimed | error
  const adRef = useRef(null);

  async function loadAd() {
    setStatus("loading");
    try {
      // Ask our backend for a short-lived token tying this ad view to the
      // logged-in user. AdMob passes it straight through to our SSV callback.
      const { data } = await api.post("/wallet/rewards/session");

      const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID, {
        serverSideVerificationOptions: {
          userId: undefined, // not needed — customData carries the identity
          customData: data.customData,
        },
      });

      const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setStatus("ready");
      });
      const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        // This fires client-side as a UX signal only. The coins themselves
        // are credited server-side once Google's SSV callback lands and is
        // verified — see backend /wallet/rewards/ssv. We just refresh here.
        setStatus("claimed");
        onRewardClaimed?.();
      });
      const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
      });
      const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
        setStatus("error");
      });

      adRef.current = rewarded;
      rewarded.load();
    } catch (err) {
      setStatus("error");
    }
  }

  useEffect(() => {
    loadAd();
  }, []);

  function watch() {
    if (status !== "ready" || !adRef.current) return;
    setStatus("watching");
    adRef.current.show();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>SPONSORED · REWARDED</Text>
      <Text style={styles.sponsor}>{sponsorLabel}</Text>

      {status === "loading" && <ActivityIndicator color="#F2B84B" style={{ marginTop: 16 }} />}

      {status === "ready" && (
        <Pressable style={styles.button} onPress={watch}>
          <Text style={styles.buttonText}>Watch to earn coins</Text>
        </Pressable>
      )}

      {status === "claimed" && <Text style={styles.claimed}>Coins on the way ✓</Text>}
      {status === "error" && <Text style={styles.errorText}>Ad not available right now</Text>}

      <Text style={styles.note}>
        Coins are credited only once your device sends a signed confirmation from Google that you
        finished watching — never for tapping the ad itself.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#2A1B3D",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  label: { color: "#9C8FAE", fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  sponsor: { color: "#F5EFE6", fontSize: 18, fontWeight: "700", marginBottom: 20 },
  button: { backgroundColor: "#F2B84B", borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  buttonText: { color: "#1B1225", fontWeight: "700" },
  claimed: { color: "#F2B84B", fontWeight: "700", fontSize: 16 },
  errorText: { color: "#FF5C7C" },
  note: { color: "#6d5f80", fontSize: 11, textAlign: "center", marginTop: 24, maxWidth: 260 },
});
