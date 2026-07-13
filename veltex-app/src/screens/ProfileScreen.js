import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const { logout } = useAuth();
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);

  const load = useCallback(async () => {
    const [f1, f2] = await Promise.all([
      api.get("/follow/following"),
      api.get("/follow/followers"),
    ]);
    setFollowing(f1.data.following);
    setFollowers(f2.data.followers);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function unfollow(id) {
    await api.delete(`/follow/${id}`);
    load();
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{following.length}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{followers.length}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Following</Text>
      <FlatList
        data={following}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.username}>@{item.username}</Text>
            <Pressable onPress={() => unfollow(item.id)}>
              <Text style={styles.unfollow}>Unfollow</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: "#6d5f80" }}>Not following anyone yet.</Text>}
      />

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B1225", padding: 20, paddingTop: 60 },
  statsRow: { flexDirection: "row", gap: 32, marginBottom: 24 },
  stat: { alignItems: "flex-start" },
  statNum: { color: "#F5EFE6", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#9C8FAE", fontSize: 12 },
  sectionLabel: { color: "#9C8FAE", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#2A1B3D",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  username: { color: "#F5EFE6" },
  unfollow: { color: "#9C8FAE", fontSize: 12 },
  logoutBtn: { marginTop: "auto", alignItems: "center", paddingVertical: 14 },
  logoutText: { color: "#FF5C7C", fontWeight: "600" },
});
