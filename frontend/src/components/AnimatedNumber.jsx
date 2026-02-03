import React, { useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';

/**
 * Easing: ease-out cubic for smooth deceleration at the end
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates from current value to target value over duration (ms).
 * Uses requestAnimationFrame for smooth 60fps animation.
 */
const AnimatedNumber = ({
  value = 0,
  duration = 800,
  decimals = 0,
  style = {},
  format = (n) => (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()),
  ...rest
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    // Normalize: handle string from locale formatting (e.g. "367,324" -> 367324)
    const target = typeof value === 'string'
      ? parseInt(String(value).replace(/[^0-9-]/g, ''), 10) || 0
      : Number(value) || 0;

    if (target === 0) {
      setDisplayValue(0);
      prevValueRef.current = 0;
      return;
    }

    // Always animate from 0 to target so the count-up is visible.
    // (Using prevValueRef for start caused no animation under React 18 Strict Mode
    // because the effect runs twice and on remount start === target.)
    const start = 0;
    prevValueRef.current = target;

    const tick = (now) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + (target - start) * eased;
      // flushSync so each frame is painted immediately (avoids batching hiding the animation)
      flushSync(() => setDisplayValue(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        flushSync(() => setDisplayValue(target));
        startRef.current = null;
      }
    };

    // Start on next frame so "0" is visible for one frame, then count up
    const startId = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(startId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span style={style} {...rest}>
      {format(displayValue)}
    </span>
  );
};

export default AnimatedNumber;
