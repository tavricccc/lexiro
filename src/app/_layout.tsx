import { hydrateStorage } from "@/platform/install";

import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Animated, { FadeOut } from "react-native-reanimated";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { ToastHost } from "@/components/toast-host";
import { useAuth } from "@/data/auth";
import { useAnswerFlush } from "@/data/learning";
import { restoreTheme, useThemeSync } from "@/data/prefs";
import { queryClient, startPersistence, stopPersistence, useRevisionWatch } from "@/data/queries";
import { useAppUpdates } from "@/lib/app-updates";
import { modalHeaderOptions, softEdges } from "@/components/stack-options";
import { PINE_DARK, PINE_LIGHT, colors, fonts, plain, type } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [storageReady, setStorageReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(fonts);
  const fontsSettled = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    void hydrateStorage().then(() => {
      restoreTheme();
      setStorageReady(true);
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell storageReady={storageReady} fontsSettled={fontsSettled} />
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function AppShell({
  storageReady,
  fontsSettled,
}: {
  storageReady: boolean;
  fontsSettled: boolean;
}) {
  const scheme = useColorScheme();
  const { ready, account } = useAuth();
  const uid = account?.uid ?? null;
  const [restoredUid, setRestoredUid] = useState<string | null>(null);

  useAppUpdates();
  const workspaceReady = Boolean(storageReady && ready && uid && restoredUid === uid);
  useRevisionWatch(workspaceReady);
  useAnswerFlush(workspaceReady);
  useThemeSync();

  useEffect(() => {
    if (!storageReady || !ready) return;
    let cancelled = false;
    if (uid) {
      void startPersistence(uid).then(() => {
        if (!cancelled) setRestoredUid(uid);
      });
    } else {
      void stopPersistence().then(() => {
        if (!cancelled) setRestoredUid(null);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [storageReady, ready, uid]);

  useEffect(() => {
    if (!fontsSettled || !storageReady || !ready) return;
    if (!uid || restoredUid === uid) {
      void SplashScreen.hideAsync();
    }
  }, [fontsSettled, storageReady, ready, uid, restoredUid]);

  const dark = scheme === "dark";
  const base = dark ? DarkTheme : DefaultTheme;
  const canvas = dark ? plain.canvas.dark : plain.canvas.light;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: dark ? PINE_DARK : PINE_LIGHT,
      background: canvas,
      card: dark ? plain.surface.dark : plain.surface.light,
      text: dark ? plain.ink.dark : plain.ink.light,
    },
  };

  const showSignIn = storageReady && ready && !uid;
  const restoring = storageReady && ready && Boolean(uid) && restoredUid !== uid;

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ ...softEdges, headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="practice"
          options={{
            headerShown: true,
            title: "練習",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
            headerTintColor: dark ? plain.ink.dark : plain.ink.light,
            headerTransparent: true,
            contentStyle: { backgroundColor: canvas },
          }}
        />
        <Stack.Screen
          name="session"
          options={{ ...modalHeaderOptions, presentation: "fullScreenModal", gestureEnabled: false }}
        />
        <Stack.Screen
          name="room/[code]"
          options={{ ...modalHeaderOptions, presentation: "fullScreenModal", gestureEnabled: false }}
        />
        <Stack.Screen
          name="sets/new"
          options={{ ...modalHeaderOptions, presentation: "formSheet", sheetGrabberVisible: true }}
        />
        <Stack.Screen
          name="sets/move"
          options={{
            ...modalHeaderOptions,
            presentation: "formSheet",
            sheetAllowedDetents: [0.68, 0.95],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="sets/shared/[shareId]"
          options={{ ...modalHeaderOptions, presentation: "modal" }}
        />
        <Stack.Screen
          name="sets/[setId]/settings"
          options={{ ...modalHeaderOptions, presentation: "modal" }}
        />
        <Stack.Screen
          name="sets/[setId]/share"
          options={{
            ...modalHeaderOptions,
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 0.78],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="sets/[setId]/copy"
          options={{
            ...modalHeaderOptions,
            presentation: "formSheet",
            sheetAllowedDetents: [0.68, 0.95],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="sets/[setId]/cards"
          options={{ ...modalHeaderOptions, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="sets/[setId]/add"
          options={{ ...modalHeaderOptions, presentation: "modal" }}
        />
        <Stack.Screen
          name="sets/[setId]/words/[wordId]/index"
          options={{
            ...modalHeaderOptions,
            presentation: "formSheet",
            sheetAllowedDetents: [0.72, 0.96],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="sets/[setId]/words/[wordId]/edit"
          options={{ ...modalHeaderOptions, presentation: "modal" }}
        />
        <Stack.Screen
          name="sets/[setId]/questions/[questionId]"
          options={{
            headerShown: true,
            title: "題目",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
            headerTintColor: dark ? plain.ink.dark : plain.ink.light,
            headerTransparent: true,
            contentStyle: { backgroundColor: canvas },
          }}
        />
      </Stack>

      {showSignIn ? (
        <Animated.View exiting={FadeOut.duration(220)} style={StyleSheet.absoluteFill}>
          <SignInPrompt />
        </Animated.View>
      ) : null}

      {restoring ? (
        <View style={[StyleSheet.absoluteFill, styles.restoring]}>
          <ActivityIndicator size="small" color={dark ? plain.inkMuted.dark : plain.inkMuted.light} />
          <Text style={styles.restoringText}>正在載入你的單字…</Text>
        </View>
      ) : null}

      <ToastHost />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  restoring: {
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  restoringText: {
    ...type.body,
    color: colors.inkMuted,
  },
});
