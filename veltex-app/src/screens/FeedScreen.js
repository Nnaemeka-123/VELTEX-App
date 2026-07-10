import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Dimensions, ActivityIndicator } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { api } from "../api/client";
import RewardedAdCard from "../components/RewardedAdCard";

const { height } = Dimensions.get("window");

function VideoCard({ item }) {
  const [following, setFollowing] = useState(false);

  async function toggleFollow() {
    const next = !following;
    setFollowing(next); // optimistic
    try {
      if (next) await api.post(`/follow/${item.creator_id}`);
      else await api.delete(`/follow/${item.creator_id}`);
    } catch {
      setFollowing(!next); // revert on failure
    }
  }

  return (
    <View style={styles.slide}>
      <Video
        source={{ uri: item.video_url }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted={false}
      />
      <View style={styles.overlay}>
        <View style={styles.creatorRow}>
          <Text style={styles.creatorName}>@{item.creator_username}</Text>
          <Pressable onPress={toggleFollow} style={[styles.followBtn, following && styles.followingBtn]}>
            <Text style={styles.followText}>{following ? "Following" : "Follow"}</Text>
          </Pressable>
        </View>
        {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState([]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/feed?limit=20");
      setVideos(data.videos);

      // interleave a rewarded-ad slide every 3rd video
      const items = [];
      data.videos.forEach((v, i) => {
        items.push({ kind: "video", ...v, key: v.id });
        if ((i + 1) % 3 === 0) {
          items.push({ kind: "ad", key: `ad-${i}`, sponsor: "Rewarded video" });
        }
      });
      setFeedItems(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F2B84B" size="large" />
      </View>
    );
  }

  if (feedItems.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#9C8FAE" }}>No videos yet — post something with POST /feed.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={feedItems}
      keyExtractor={(item) => item.key}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={height}
      decelerationRate="fast"
      renderItem={({ item }) =>
        item.kind === "video" ? (
          <VideoCard item={item} />
        ) : (
          <View style={{ height, width: "100%" }}>
            <RewardedAdCard sponsorLabel={item.sponsor} onRewardClaimed={() => {}} />
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#1B1225", alignItems: "center", justifyContent: "center" },
  slide: { height, width: "100%", backgroundColor: "#000" },
  overlay: { position: "absolute", left: 0, right: 60, bottom: 24, padding: 16 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  creatorName: { color: "#F5EFE6", fontWeight: "700" },
  followBtn: { borderWidth: 1, borderColor: "#9C8FAE", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  followingBtn: { borderColor: "#F2B84B" },
  followText: { color: "#F5EFE6", fontSize: 12, fontWeight: "600" },
  caption: { color: "#F5EFE6", fontSize: 14 },
});
