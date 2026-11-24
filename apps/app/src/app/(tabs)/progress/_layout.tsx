import { Stack } from "expo-router";

import { largeTitleOptions } from "@/components/stack-options";

export default function ProgressLayout() {
  return (
    <Stack screenOptions={largeTitleOptions}>
      <Stack.Screen name="index" options={{ title: "進度" }} />
    </Stack>
  );
}
