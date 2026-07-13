import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { api } from "../api/client";

export default function WalletScreen() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [balRes, ledgerRes] = await Promise.all([
      api.get("/wallet"),
      api.get("/wallet/ledger"),
    ]);
    setBalance(balRes.data.balance);
    setLedger(ledgerRes.data.ledger);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.balanceLabel}>Balance</Text>
      <Text style={styles.balance}>{balance} coins</Text>

      <Text style={styles.sectionLabel}>Activity</Text>
      <FlatList
        data={ledger}
        keyExtractor={(item, i) => `${item.ref_id || i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F2B84B" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.reason}>{item.reason.replace(/_/g, " ")}</Text>
            <Text style={[styles.amount, { color: item.amount >= 0 ? "#F2B84B" : "#FF5C7C" }]}>
              {item.amount >= 0 ? "+" : ""}
              {item.amount}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: "#6d5f80" }}>No activity yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B1225", padding: 20, paddingTop: 60 },
  balanceLabel: { color: "#9C8FAE", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  balance: { color: "#F5EFE6", fontSize: 40, fontWeight: "800", marginBottom: 24 },
  sectionLabel: { color: "#9C8FAE", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#2A1B3D",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  reason: { color: "#F5EFE6", textTransform: "capitalize" },
  amount: { fontWeight: "700" },
});
