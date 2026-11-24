import { useEffect, useRef, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

/** Smoothly counts from the previous integer value to the next over ~360ms. */
export function AnimatedNumber({
  value,
  style,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const start = fromRef.current;
    const end = value;
    if (start === end) return;
    const duration = 360;
    const began = Date.now();
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - began;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = end;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = end;
    };
  }, [value]);

  return (
    <Text style={[style, { fontVariant: ["tabular-nums"] }]}>
      {display}
    </Text>
  );
}
