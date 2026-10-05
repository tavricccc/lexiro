"use client";
import { useEffect, useRef, useState } from "react";

/** Visible output tokens over the preceding 500 ms, sampled every 100 ms. */
export function useTokenRate(tokens: number, active: boolean) {
  const latest = useRef(tokens);
  latest.current = tokens;
  const [rate, setRate] = useState(0);
  useEffect(() => {
    setRate(0);
    if (!active) return;
    let previous = latest.current;
    let samples: { at: number; delta: number }[] = [];
    const timer = setInterval(() => {
      const now = performance.now();
      const count = latest.current;
      if (count < previous) {
        samples = [];
        previous = 0;
      }
      samples.push({ at: now, delta: Math.max(0, count - previous) });
      previous = count;
      samples = samples.filter((sample) => sample.at > now - 500);
      setRate(samples.reduce((sum, sample) => sum + sample.delta, 0) / 0.5);
    }, 100);
    return () => clearInterval(timer);
  }, [active]);
  return rate;
}
