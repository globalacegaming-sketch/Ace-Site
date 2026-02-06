'use client';

// ============================================
// COSMIC SPINNER - WHEEL COMPONENT (v2)
// ============================================
// Key fixes over v1:
// - Wheel spins IMMEDIATELY on click (no dead time waiting for API)
// - Server picks the winner (security fix)
// - Single API call instead of two
// - Quintic ease-out: no overshoot, no jumps
// - useRef for animation angle: ~300 fewer re-renders per spin
// - Font preloaded in index.html (no @import flicker)
// ============================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, LogIn } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getApiBaseUrl } from '../../utils/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface WheelConfig {
  isEnabled: boolean;
}

interface SpinResult {
  spinId: string;
  rewardType: string;
  rewardLabel: string;
  rewardValue: string | null;
  rewardColor: string;
  bonusSent: boolean;
  messageId?: string;
  sliceOrder?: number;
}

// ── Segments (must match backend/src/config/wheelSegments.ts) ────────────────

const SEGMENTS = [
  { type: 'bonus_1', label: '$1', color: '#10B981' },
  { type: 'bonus_5', label: '$5', color: '#3B82F6' },
  { type: 'try_again', label: 'Free Spin +1', wheelLabel: 'Free Spin +1', color: '#F59E0B' },
  { type: 'bonus_1', label: '$1', color: '#10B981' },
  { type: 'better_luck', label: 'Better Luck', color: '#6B7280' },
  { type: 'bonus_10', label: '$10', color: '#8B5CF6' },
  { type: 'better_luck', label: 'Better Luck', color: '#6B7280' },
  { type: 'bonus_5', label: '$5', color: '#3B82F6' },
  { type: 'bonus_1', label: '$1', color: '#10B981' },
  { type: 'try_again', label: 'Free Spin +1', wheelLabel: 'Free Spin +1', color: '#F59E0B' },
  { type: 'bonus_50_percent', label: '50%', color: '#EC4899' },
  { type: 'better_luck', label: 'Better Luck', color: '#6B7280' },
  { type: 'bonus_1', label: '$1', color: '#10B981' },
  { type: 'bonus_5', label: '$5', color: '#3B82F6' },
  { type: 'better_luck', label: 'Better Luck', color: '#6B7280' }
];

// ── Animation constants ─────────────────────────────────────────────────────

const TAU = 2 * Math.PI;
const CONSTANT_VELOCITY = 14;       // rad/s during constant-spin phase
const RAMP_DURATION = 0.4;          // seconds to ramp from 0 → full velocity
const DECEL_DURATION = 4500;         // ms for deceleration to target
const MIN_EXTRA_ROTATIONS = 4;       // minimum full rotations during deceleration

/** Quintic ease-out: smooth deceleration, never exceeds 1.0 */
const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);

/**
 * Compute distance the wheel has travelled during the constant-spin phase,
 * accounting for a soft ramp from 0 → CONSTANT_VELOCITY over RAMP_DURATION.
 * - During ramp:  integral of (V * t / R) dt = V * t² / 2R
 * - After ramp:   rampDist + V * (t - R)
 */
const spinDistance = (elapsedSec: number): number => {
  if (elapsedSec <= RAMP_DURATION) {
    return CONSTANT_VELOCITY * elapsedSec * elapsedSec / (2 * RAMP_DURATION);
  }
  const rampDist = CONSTANT_VELOCITY * RAMP_DURATION / 2;
  return rampDist + CONSTANT_VELOCITY * (elapsedSec - RAMP_DURATION);
};

// ── Animation state kept in a ref (never triggers React re-renders) ─────────

type AnimPhase = 'idle' | 'spinning' | 'decelerating';

interface AnimState {
  phase: AnimPhase;
  startAngle: number;
  spinStartTime: number;
  decelStartTime: number;
  decelStartAngle: number;
  targetAngle: number;
  apiResult: SpinResult | null;
  isError: boolean;
}

const defaultAnimState = (): AnimState => ({
  phase: 'idle',
  startAngle: 0,
  spinStartTime: 0,
  decelStartTime: 0,
  decelStartAngle: 0,
  targetAngle: 0,
  apiResult: null,
  isError: false,
});

// ── Component ───────────────────────────────────────────────────────────────

interface WheelProps {
  size?: number;
}

export default function Wheel({ size: initialSize = 500 }: WheelProps) {
  // ── Responsive sizing ──
  const [wheelSize, setWheelSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w < 400) return Math.max(260, Math.min(w - 16, 320));
      if (w < 768) return Math.min(w - 24, 360);
      return initialSize;
    }
    return initialSize;
  });
  const size = wheelSize;

  // ── Auth / routing ──
  const { isAuthenticated, token, checkSession, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Refs ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const animRef = useRef<AnimState>(defaultAnimState());

  // ── UI state (not used per-frame — only for React renders) ──
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [config, setConfig] = useState<WheelConfig | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);

  const API_BASE_URL = getApiBaseUrl();

  const isAdminOrAgentPage =
    location.pathname.startsWith('/aceadmin') || location.pathname.startsWith('/aceagent');
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  // ── Responsive resize ──
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let s: number;
      if (w < 400) s = Math.max(260, Math.min(w - 16, 320));
      else if (w < 768) s = Math.min(w - 24, 360);
      else s = initialSize;
      setWheelSize(s);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialSize]);

  // ── Load wheel config on mount ──
  useEffect(() => {
    if (isAdminOrAgentPage || isAuthPage) return;
    axios.get(`${API_BASE_URL}/wheel/config`)
      .then(r => { if (r.data.success) setConfig(r.data.data); })
      .catch(e => console.error('Failed to load wheel config:', e));
  }, [API_BASE_URL, isAdminOrAgentPage, isAuthPage]);

  // ── Canvas geometry ──
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 10;

  // ── Which segment index is under the pointer at 12-o'clock ──
  const getIndex = useCallback((angle: number): number => {
    const arc = TAU / SEGMENTS.length;
    const norm = ((angle % TAU) + TAU) % TAU;
    const r = (3 * Math.PI / 2 - norm + TAU) % TAU;
    return Math.floor(r / arc) % SEGMENTS.length;
  }, []);

  // ── Adjust hex colour brightness ──
  const adjustColor = useCallback((color: string, amount: number): string => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  // ── Draw the wheel on canvas ──
  const drawWheel = useCallback(
    (angle: number, spinning: boolean, centerLabel?: string | null, centerColor?: string | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);
      const normalizedAngle = ((angle % TAU) + TAU) % TAU;
      const segmentAngle = TAU / SEGMENTS.length;
      const glowIntensity = spinning ? 25 : 15;
      const borderGlow = spinning ? 12 : 8;

      // Draw segments
      SEGMENTS.forEach((segment, i) => {
        const startA = normalizedAngle + i * segmentAngle;
        const endA = startA + segmentAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startA, endA);
        ctx.closePath();

        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, adjustColor(segment.color, spinning ? 60 : 40));
        gradient.addColorStop(0.6, segment.color);
        gradient.addColorStop(1, adjustColor(segment.color, -40));
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = spinning ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = spinning ? 3 : 2;
        ctx.shadowColor = segment.color;
        ctx.shadowBlur = borderGlow;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Slice text
        const sliceText =
          'wheelLabel' in segment && (segment as { wheelLabel?: string }).wheelLabel != null
            ? (segment as { wheelLabel: string }).wheelLabel
            : segment.label;
        const baseFontSize = Math.max(11, Math.round(size / 22));
        const fontSize = sliceText.length > 10 ? Math.max(9, Math.round(size / 26)) : baseFontSize;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startA + segmentAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${fontSize}px 'Orbitron', monospace`;
        ctx.shadowColor = spinning ? segment.color : 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = spinning ? 8 : 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(sliceText, radius - Math.max(8, size / 28), 0);
        ctx.restore();
      });

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 3, 0, TAU);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = spinning ? 4 : 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = glowIntensity;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Additional neon ring when spinning
      if (spinning) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 8, 0, TAU);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Center circle
      const centerRad = size / 12;
      ctx.beginPath();
      ctx.arc(centerX, centerY, centerRad, 0, TAU);
      if (centerColor) {
        ctx.fillStyle = centerColor;
        ctx.shadowColor = centerColor;
      } else {
        const cg = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, centerRad);
        cg.addColorStop(0, '#FF1493');
        cg.addColorStop(0.5, '#FF69B4');
        cg.addColorStop(1, '#DA70D6');
        ctx.fillStyle = cg;
        ctx.shadowColor = '#FF1493';
      }
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();

      const text = centerLabel != null && centerLabel !== '' ? centerLabel : 'SPIN';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(12, Math.round(size / 18))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(text, centerX, centerY);
      ctx.shadowBlur = 0;
    },
    [size, centerX, centerY, radius, adjustColor]
  );

  // ── Calculate target angle for a given segment index ──
  const calculateTargetAngle = useCallback((sliceOrder: number): number => {
    const segAngle = TAU / SEGMENTS.length;
    const targetCenter = sliceOrder * segAngle + segAngle / 2;
    const targetAngle = 3 * Math.PI / 2 - targetCenter;
    return ((targetAngle % TAU) + TAU) % TAU;
  }, []);

  // ── Keep latest callbacks in refs for the animation loop ──
  const callbacksRef = useRef({ drawWheel, getIndex });
  useEffect(() => {
    callbacksRef.current = { drawWheel, getIndex };
  });

  // ── Start the rAF animation loop (stable — reads from refs) ──
  const startAnimLoop = useCallback(() => {
    const loop = () => {
      const anim = animRef.current;
      const { drawWheel: dw, getIndex: gi } = callbacksRef.current;

      if (anim.phase === 'spinning') {
        // Constant-velocity spin with soft ramp-up
        const elapsedSec = (Date.now() - anim.spinStartTime) / 1000;
        angleRef.current = anim.startAngle + spinDistance(elapsedSec);

        const idx = gi(angleRef.current);
        dw(angleRef.current, true, SEGMENTS[idx].label, SEGMENTS[idx].color);

        animFrameRef.current = requestAnimationFrame(loop);
      } else if (anim.phase === 'decelerating') {
        // Quintic ease-out to target angle
        const elapsed = Date.now() - anim.decelStartTime;
        const progress = Math.min(elapsed / DECEL_DURATION, 1);
        const eased = easeOutQuint(progress);

        const totalAngle = anim.targetAngle - anim.decelStartAngle;
        angleRef.current = anim.decelStartAngle + totalAngle * eased;

        // Still show "spinning" neon until 95% done
        const idx = gi(angleRef.current);
        dw(angleRef.current, progress < 0.95, SEGMENTS[idx].label, SEGMENTS[idx].color);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(loop);
        } else {
          // ── Animation complete ──
          anim.phase = 'idle';
          animFrameRef.current = null;
          // Snap to exact target (normalized)
          angleRef.current = ((anim.targetAngle % TAU) + TAU) % TAU;

          if (anim.isError) {
            // Error: just stop, toast was already shown
            setIsSpinning(false);
            dw(angleRef.current, false);
          } else if (anim.apiResult) {
            // Success: show result
            const result = anim.apiResult;
            setLastResult(result);
            setIsSpinning(false);
            setShowResult(true);
            dw(angleRef.current, false, result.rewardLabel, result.rewardColor);
          } else {
            setIsSpinning(false);
            dw(angleRef.current, false);
          }
        }
      }
      // If phase is 'idle', do nothing (loop stops)
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, []);

  // ── Core spin logic (called by click handler and Spin Again) ──
  const doSpin = useCallback(async () => {
    // Reset UI
    setIsSpinning(true);
    setShowResult(false);
    setLastResult(null);

    // Start constant-velocity spin IMMEDIATELY (instant visual feedback)
    const anim = animRef.current;
    anim.phase = 'spinning';
    anim.startAngle = angleRef.current;
    anim.spinStartTime = Date.now();
    anim.apiResult = null;
    anim.isError = false;

    startAnimLoop();

    // Fire single API call (wheel is already visually spinning)
    const authToken = useAuthStore.getState().token;
    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/wheel/spin`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Spin failed');
      }

      const data = response.data.data;
      const targetAngle = calculateTargetAngle(data.sliceOrder);

      // Compute deceleration target: current angle → target with extra full rotations
      const currentAngle = angleRef.current;
      const normCurrent = ((currentAngle % TAU) + TAU) % TAU;
      const normTarget = ((targetAngle % TAU) + TAU) % TAU;
      let diff = normTarget - normCurrent;
      if (diff < 0) diff += TAU;
      const finalTarget = currentAngle + diff + MIN_EXTRA_ROTATIONS * TAU;

      // Store API result
      anim.apiResult = {
        spinId: data.spinId,
        rewardType: data.rewardType,
        rewardLabel: data.rewardLabel,
        rewardValue: data.rewardValue,
        rewardColor: data.rewardColor,
        bonusSent: data.bonusSent,
        messageId: data.messageId,
        sliceOrder: data.sliceOrder,
      };

      // Switch to deceleration phase
      anim.decelStartTime = Date.now();
      anim.decelStartAngle = angleRef.current;
      anim.targetAngle = finalTarget;
      anim.phase = 'decelerating';
    } catch (error: any) {
      // API failed — smoothly decelerate to random stop
      const randomStop = angleRef.current + 2 * TAU + Math.random() * TAU;
      anim.isError = true;
      anim.decelStartTime = Date.now();
      anim.decelStartAngle = angleRef.current;
      anim.targetAngle = randomStop;
      anim.phase = 'decelerating';

      // Show appropriate error toast
      if (error.response?.status === 401) {
        useAuthStore.getState().logout();
        toast.error('Your session has expired. Please login again.');
      } else if (error.response?.status === 400) {
        const msg = error.response.data.message || 'Unable to spin the wheel';
        if (msg.includes('already used') || msg.includes('spin limit') || msg.includes('all your spins')) {
          toast.error('You have used all your spins!', { duration: 5000, icon: '⚠️' });
        } else {
          toast.error(msg, { duration: 4000 });
        }
      } else {
        toast.error('Failed to spin the wheel. Please try again.');
      }
    }
  }, [startAnimLoop, calculateTargetAngle]);

  // ── Handle canvas click ──
  const handleSpinClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
      }
      if (animRef.current.phase !== 'idle') return;
      if (!checkSession()) {
        logout();
        toast.error('Your session has expired. Please login again.');
        return;
      }

      doSpin();
    },
    [isAuthenticated, checkSession, logout, doSpin]
  );

  // ── Initial draw when modal opens (waits for font to be ready) ──
  useEffect(() => {
    if (!isOpen) return;
    if (animRef.current.phase !== 'idle') return;

    const draw = () => drawWheel(angleRef.current, false);

    if (document.fonts?.ready) {
      document.fonts.ready.then(draw);
    } else {
      draw();
    }
  }, [isOpen, drawWheel, size]);

  // ── Redraw when result shown (wheel is idle) ──
  useEffect(() => {
    if (!isOpen || animRef.current.phase !== 'idle') return;
    if (showResult && lastResult) {
      drawWheel(angleRef.current, false, lastResult.rewardLabel, lastResult.rewardColor);
    }
  }, [isOpen, showResult, lastResult, drawWheel]);

  // ── Cleanup animation on unmount ──
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  // ── Stop everything (used by close/reset buttons) ──
  const stopAndReset = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    animRef.current = defaultAnimState();
    setIsSpinning(false);
    setShowResult(false);
    setLastResult(null);
  }, []);

  // Don't show on admin/agent pages, login/signup, while config is loading, or disabled
  if (isAdminOrAgentPage || isAuthPage || !config || config.isEnabled === false) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <div className="fixed z-[100] top-1/2 -translate-y-[calc(50%-2px)] right-4 sm:right-6">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center p-1.5 bg-transparent hover:scale-110 active:scale-95 transition-transform touch-manipulation min-w-[60px] min-h-[60px] sm:min-w-[72px] sm:min-h-[72px]"
          aria-label="Open Wheel of Fortune"
        >
          <img src="/WHeels.png" alt="" className="w-[100px] h-[100px] object-contain drop-shadow-md" />
        </button>
      </div>

      {/* Wheel Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0, 20, 40, 0.95) 0%, rgba(0, 0, 0, 0.98) 100%)',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(5rem, calc(4rem + env(safe-area-inset-bottom)))',
          }}
          onClick={() => {
            if (!isSpinning && animRef.current.phase === 'idle') {
              stopAndReset();
              setIsOpen(false);
              setShowLoginModal(false);
            }
          }}
        >
          <div
            className="relative flex-shrink-0 flex flex-col items-center -translate-y-10 sm:translate-y-0"
            style={{ width: size }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Wheel and overlay elements */}
            <div
              className="relative"
              style={{ width: size, height: size, minWidth: size, minHeight: size }}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  stopAndReset();
                  setIsOpen(false);
                  setShowLoginModal(false);
                }}
                className="absolute -top-10 sm:-top-12 right-0 sm:right-0 text-white hover:text-gray-300 active:text-gray-400 transition-colors z-10 p-3 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center touch-manipulation"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Glow effect behind wheel */}
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ${
                  isSpinning ? 'animate-pulse' : 'opacity-50'
                }`}
                style={{
                  width: isSpinning ? size + 80 : size + 40,
                  height: isSpinning ? size + 80 : size + 40,
                  background: isSpinning
                    ? 'radial-gradient(circle, rgba(0, 255, 255, 0.6) 0%, rgba(255, 0, 255, 0.4) 30%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(0, 255, 255, 0.3) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                  animation: isSpinning ? 'neonPulse 1s ease-in-out infinite' : 'none',
                }}
              />

              {/* Pointer at top */}
              <div
                className="absolute left-1/2 z-10 pointer-events-none"
                style={{
                  top: size < 380 ? -10 : -14,
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: size < 380 ? '9px solid transparent' : '12px solid transparent',
                  borderRight: size < 380 ? '9px solid transparent' : '12px solid transparent',
                  borderBottom: 'none',
                  borderTop: size < 380 ? '18px solid #ffd700' : '24px solid #ffd700',
                  filter: 'drop-shadow(0 0 8px #ffd700)',
                }}
                aria-hidden
              />

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={size}
                height={size}
                className="relative z-[1] cursor-pointer transition-all duration-300 touch-manipulation"
                style={{
                  filter: isSpinning
                    ? 'drop-shadow(0 0 40px rgba(0, 255, 255, 0.8)) drop-shadow(0 0 60px rgba(255, 0, 255, 0.6))'
                    : 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.5))',
                  transform: isSpinning ? 'scale(1.02)' : 'scale(1)',
                }}
                onClick={handleSpinClick}
              />

              {/* Login Modal */}
              {showLoginModal && (
                <div className="absolute inset-0 bg-black bg-opacity-90 rounded-full flex items-center justify-center z-30 p-3 sm:p-4">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 sm:p-8 text-center max-w-xs w-full mx-2 sm:mx-4">
                    <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔒</div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                      Sign In Required
                    </h3>
                    <p className="text-white text-sm sm:text-base mb-4 sm:mb-6">
                      Please sign in to spin the wheel!
                    </p>
                    <div className="flex gap-3 sm:gap-4 flex-col sm:flex-row">
                      <button
                        onClick={() => setShowLoginModal(false)}
                        className="flex-1 min-h-[44px] px-4 py-3 sm:py-2 bg-gray-600 text-white font-semibold rounded-full hover:bg-gray-700 active:bg-gray-800 transition-colors touch-manipulation"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setShowLoginModal(false);
                          navigate('/login');
                        }}
                        className="flex-1 min-h-[44px] px-4 py-3 sm:py-2 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center justify-center gap-2 touch-manipulation"
                      >
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result card */}
          {showResult &&
            lastResult &&
            (() => {
              const actualSegment =
                lastResult.sliceOrder != null
                  ? SEGMENTS[Math.max(0, Math.min(lastResult.sliceOrder, SEGMENTS.length - 1))]
                  : SEGMENTS.find((s) => s.type === lastResult.rewardType) || SEGMENTS[0];
              return (
                <div
                  className="fixed z-[60] max-w-[280px] sm:max-w-sm mx-auto rounded-xl sm:rounded-2xl px-3 py-2.5 sm:p-6 text-center border border-[#2C2C3A]"
                  style={{
                    bottom: 'max(7rem, calc(6rem + env(safe-area-inset-bottom)))',
                    left: 'max(1rem, env(safe-area-inset-left))',
                    right: 'max(1rem, env(safe-area-inset-right))',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
                    boxShadow:
                      '0 0 30px rgba(106, 27, 154, 0.4), 0 0 20px rgba(0, 176, 255, 0.25), 0 4px 20px rgba(0,0,0,0.3)',
                    animation: 'neonFlicker 0.5s ease-in-out',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-3xl sm:text-5xl mb-1 sm:mb-3">
                    {actualSegment.type === 'better_luck'
                      ? '😔'
                      : actualSegment.type === 'try_again'
                        ? '🔄'
                        : '🎉'}
                  </div>
                  <h3 className="text-lg sm:text-3xl font-bold text-white mb-0.5 sm:mb-2">
                    {lastResult.rewardLabel}
                  </h3>
                  {actualSegment.type === 'better_luck' && (
                    <p className="text-white/90 text-xs sm:text-base mb-2 sm:mb-4">
                      Better luck next time!
                    </p>
                  )}
                  {actualSegment.type === 'try_again' && (
                    <p className="text-white/90 text-xs sm:text-base mb-2 sm:mb-4">
                      You get an extra spin!
                    </p>
                  )}
                  {actualSegment.type.startsWith('bonus_') && (
                    <p className="text-white/90 text-xs sm:text-base mb-2 sm:mb-4">
                      Your bonus has been sent to your chat!
                    </p>
                  )}
                  <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
                    <button
                      onClick={() => stopAndReset()}
                      className="min-h-[40px] sm:min-h-[44px] px-3 py-2 sm:px-5 sm:py-2.5 bg-white/95 text-[#0A0A0F] font-bold text-sm sm:text-base rounded-full hover:scale-105 active:scale-95 transition-transform touch-manipulation"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        stopAndReset();
                        // Small delay to let React flush state, then spin again
                        setTimeout(() => doSpin(), 50);
                      }}
                      className="min-h-[40px] sm:min-h-[44px] px-3 py-2 sm:px-5 sm:py-2.5 font-bold text-sm sm:text-base rounded-full border-2 border-[#FFD700] hover:scale-105 active:scale-95 transition-transform touch-manipulation"
                      style={{
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                        color: '#0A0A0F',
                        boxShadow: '0 0 15px rgba(255, 215, 0, 0.3)',
                      }}
                    >
                      Spin Again
                    </button>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      <style>{`
        @keyframes neonFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes neonPulse {
          0%, 100% { 
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          50% { 
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
        @keyframes neonSpin {
          0% { filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.5)); }
          25% { filter: drop-shadow(0 0 40px rgba(255, 0, 255, 0.8)); }
          50% { filter: drop-shadow(0 0 30px rgba(0, 255, 255, 0.9)); }
          75% { filter: drop-shadow(0 0 50px rgba(255, 255, 0, 0.7)); }
          100% { filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.5)); }
        }
      `}</style>
    </>
  );
}
