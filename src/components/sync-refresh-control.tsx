import { useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";

import { errorMessage } from "@/data/api";
import { flushAnswers } from "@/data/learning";
import { refreshAll } from "@/data/queries";
import { haptics } from "@/lib/haptics";
import { PINE_DARK, PINE_LIGHT } from "@/lib/theme";
import { toast } from "@/platform/toast";

/** Native pull-to-refresh that flushes queued learning answers and refetches what changed. */
export function SyncRefreshControl({ onRefreshed }: { onRefreshed?: () => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const dark = useColorScheme() === "dark";

  const onRefresh = async () => {
    setRefreshing(true);
    haptics.tap();
    try {
      await flushAnswers();
      await refreshAll();
      haptics.success();
      onRefreshed?.();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      tintColor={dark ? PINE_DARK : PINE_LIGHT}
    />
  );
}
