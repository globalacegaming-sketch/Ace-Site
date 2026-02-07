/**
 * Haptic feedback utility for mobile devices.
 * Uses the Vibration API (Android) with graceful fallback.
 */
type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const patterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 30, 10],
  warning: [20, 40, 20],
  error: [30, 50, 30, 50, 30],
};

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(patterns[type] ?? 10);
    } catch {
      // Silently fail – vibration is a nice-to-have
    }
  }
}
