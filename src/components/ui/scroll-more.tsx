import { Button, Host, Image } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { useCallback, useContext, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptics } from "@/lib/haptics";

const glass = isLiquidGlassAvailable();
/** Less than this below the fold is only padding. */
const SLACK = 8;

/**
 * Follows a scroll view and tells whether content is left below. Spread
 * `scrollProps` on the scroll view and render `ScrollMore` after it.
 * `underHeader` is for a scroll view whose content the system insets.
 */
export function useScrollMore({
  underHeader = false,
  onScroll,
}: {
  underHeader?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
} = {}) {
  const header = useContext(HeaderHeightContext) ?? 0;
  const start = underHeader ? -header : 0;
  const view = useRef<Pick<ScrollView, "scrollTo"> | null>(null);
  const metrics = useRef({ offset: null as number | null, height: 0, content: 0 });
  const [more, setMore] = useState(false);
  const [height, setHeight] = useState(0);

  const measure = useCallback(() => {
    const { offset, height, content } = metrics.current;
    setMore(height > 0 && content - height - (offset ?? start) > SLACK);
  }, [start]);

  const ref = useCallback((node: Pick<ScrollView, "scrollTo"> | null) => {
    view.current = node;
    // A scroll view that is new starts at its top.
    metrics.current.offset = null;
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      metrics.current.offset = event.nativeEvent.contentOffset.y;
      measure();
      onScroll?.(event);
    },
    [measure, onScroll],
  );
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      metrics.current.height = event.nativeEvent.layout.height;
      setHeight(event.nativeEvent.layout.height);
      measure();
    },
    [measure],
  );
  const onContentSizeChange = useCallback(
    (_width: number, content: number) => {
      metrics.current.content = content;
      measure();
    },
    [measure],
  );

  /** One page further, keeping the last lines in sight. */
  const scrollOn = useCallback(() => {
    const { offset, height } = metrics.current;
    haptics.select();
    view.current?.scrollTo({ y: (offset ?? start) + height * 0.7, animated: true });
  }, [start]);

  return {
    more,
    height,
    scrollOn,
    scrollProps: {
      ref,
      onScroll: handleScroll,
      onLayout,
      onContentSizeChange,
      scrollEventThrottle: 16,
    },
  };
}

/** How far from the bottom the button clears the home indicator and the tab bar. */
export function useScrollMoreInset() {
  return Math.max(useSafeAreaInsets().bottom, 8) + 8;
}

/** The system's glass button, shown while a page goes on below. */
export function ScrollMore({
  visible,
  onPress,
  bottom,
}: {
  visible: boolean;
  onPress: () => void;
  bottom: number;
}) {
  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={[styles.place, { bottom }]}>
      <Host matchContents>
        <Button
          onPress={onPress}
          modifiers={[
            buttonStyle(glass ? "glass" : "bordered"),
            buttonBorderShape("circle"),
            controlSize("large"),
            accessibilityLabel("往下捲"),
          ]}
        >
          <Image systemName="chevron.down" size={17} modifiers={[frame({ width: 20, height: 22 })]} />
        </Button>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  place: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
