import { Stack } from "expo-router";

import { largeTitleOptions } from "@/components/stack-options";

export default function LibraryLayout() {
  return (
    <Stack screenOptions={largeTitleOptions}>
      <Stack.Screen name="index" options={{ title: "我的單字" }} />
      <Stack.Screen name="starred" options={{ title: "標星單字" }} />
      <Stack.Screen name="[setId]" options={{ title: "單字集" }} />
    </Stack>
  );
}
