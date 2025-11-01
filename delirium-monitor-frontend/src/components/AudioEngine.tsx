import { useEffect, useRef } from 'react';
import type { AlertTier } from '../types';

interface AudioEngineProps {
  tier: AlertTier;
  acknowledgedTier: AlertTier;
  muted: boolean;
  volume: number;
}

const REPEAT_INTERVAL_MS: Record<AlertTier, number | null> = {
  0: null,
  1: null,
  2: 60_000,
  3: 30_000,
};

export function AudioEngine({
  tier,
  acknowledgedTier,
  muted,
  volume,
}: AudioEngineProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const shouldPlay = tier > 0 && tier > acknowledgedTier && !muted;

    if (!shouldPlay) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    const play = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const duration = tier === 3 ? 1.2 : 0.7;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = tier === 1 ? 660 : tier === 2 ? 740 : 820;
      gain.gain.value = Math.max(0.0001, volume * 0.3);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + duration
      );
    };

    play();

    const repeat = REPEAT_INTERVAL_MS[tier];
    if (repeat) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      intervalRef.current = window.setInterval(play, repeat);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tier, acknowledgedTier, muted, volume]);

  return null;
}
