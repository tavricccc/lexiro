import { Stack } from "expo-router";

import { largeTitleOptions } from "@/components/stack-options";

export default function MeLayout() {
  return (
    <Stack screenOptions={largeTitleOptions}>
      <Stack.Screen name="index" options={{ title: "我" }} />
      <Stack.Screen name="account" options={{ title: "帳號與同步", headerLargeTitleEnabled: false }} />
      <Stack.Screen name="preferences" options={{ title: "偏好設定", headerLargeTitleEnabled: false }} />
      <Stack.Screen name="data" options={{ title: "資料與備份", headerLargeTitleEnabled: false }} />
      <Stack.Screen name="agents" options={{ title: "Agent 連線", headerLargeTitleEnabled: false }} />
      <Stack.Screen name="about" options={{ title: "關於 Lexiro", headerLargeTitleEnabled: false }} />
      <Stack.Screen name="admin" options={{ title: "管理後台", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
