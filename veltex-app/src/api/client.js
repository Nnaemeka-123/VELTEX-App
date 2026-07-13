import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const baseURL = Constants.expoConfig?.extra?.apiBaseUrl || "http://localhost:4000";

export const api = axios.create({ baseURL });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("veltex_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function saveToken(token) {
  await SecureStore.setItemAsync("veltex_token", token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync("veltex_token");
}

export async function getToken() {
  return SecureStore.getItemAsync("veltex_token");
}
