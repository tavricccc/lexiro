import { Stack } from "expo-router";

import { largeTitleOptions } from "@/components/stack-options";

function greeting(hour: number) {
  return hour < 5 ? "夜深了" : hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
}

export default function TodayLayout() {
  return (
    <Stack screenOptions={largeTitleOptions}>
      <Stack.Screen name="index" options={{ title: greeting(new Date().getHours()) }} />
    </Stack>
  );
}
