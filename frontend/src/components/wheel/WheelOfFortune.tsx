'use client';

// ============================================
// CASINO WHEEL OF FORTUNE (v3 — Visual Overhaul)
// ============================================
// Casino-grade visual redesign with:
//   - Glossy segments with rich radial gradients
//   - Golden bulb ring with chase animation
//   - Red casino stage/podium with multi-tier base
//   - Spotlight beams and floating sparkle particles
//   - Warm golden pointer (SVG)
// Business logic UNCHANGED from v2.
// ============================================

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
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
  bonusSpins?: number;
}

interface SpinStatus {
  spinsRemaining: number;  // normal spins left (-1 = unlimited)
  bonusSpins: number;
  totalAvailable: number;  // normal + bonus (-1 = unlimited)
  spinsPerDay: number;
  nextResetTime: string;   // ISO timestamp of next midnight reset
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

// ── Visual constants ─────────────────────────────────────────────────────────

const NUM_BULBS = 30;

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
  const { isAuthenticated, checkSession, logout } = useAuthStore();
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
  const [spinStatus, setSpinStatus] = useState<SpinStatus | null>(null);
  const [countdown, setCountdown] = useState('');

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

  // ── Fetch spin status when modal opens (authenticated users only) ──
  const fetchSpinStatus = useCallback(() => {
    if (!isAuthenticated) return;
    const authToken = useAuthStore.getState().token;
    axios.get(`${API_BASE_URL}/wheel/spin-status`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => { if (r.data.success) setSpinStatus(r.data.data); })
      .catch(() => { /* silent — status badge just won't show */ });
  }, [API_BASE_URL, isAuthenticated]);

  useEffect(() => {
    if (isOpen && isAuthenticated) fetchSpinStatus();
  }, [isOpen, isAuthenticated, fetchSpinStatus]);

  // ── Countdown timer to next reset ──
  useEffect(() => {
    if (!spinStatus?.nextResetTime) { setCountdown(''); return; }
    // Only show countdown when normal spins are exhausted but bonus spins remain,
    // OR when no spins are left at all.
    if (spinStatus.spinsRemaining === -1) { setCountdown(''); return; }
    if (spinStatus.spinsRemaining > 0) { setCountdown(''); return; }

    const tick = () => {
      const diff = new Date(spinStatus.nextResetTime).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Refreshing...'); fetchSpinStatus(); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [spinStatus, fetchSpinStatus]);

  // ── Canvas geometry (casino frame layout) ──
  const centerX = size / 2;
  const centerY = size / 2;
  const frameWidth = Math.max(14, size * 0.058);
  const outerR = size / 2 - 2;
  const wheelR = outerR - frameWidth;
  const bulbRingR = (outerR + wheelR) / 2;
  const bulbDotR = Math.max(2.5, frameWidth * 0.2);
  const centerHubR = Math.max(18, size / 9.5);

  // ── Sparkle particles (memoized) ──
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: 12 + Math.random() * 76,
      delay: Math.random() * 6,
      duration: 2.5 + Math.random() * 4,
      size: 1.5 + Math.random() * 3,
    })), []
  );

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

  // ══════════════════════════════════════════════════════════════════════════
  // DRAW WHEEL — Casino-grade canvas rendering
  // ══════════════════════════════════════════════════════════════════════════

  const drawWheel = useCallback(
    (angle: number, spinning: boolean, centerLabel?: string | null, centerColor?: string | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);
      const normalizedAngle = ((angle % TAU) + TAU) % TAU;
      const segmentAngle = TAU / SEGMENTS.length;
      const now = Date.now();

      // ──── LAYER 1: Outer decorative frame (dark mahogany ring) ────

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerR, 0, TAU);
      ctx.arc(centerX, centerY, wheelR + 1, 0, TAU, true);
      const frameGrad = ctx.createRadialGradient(centerX, centerY, wheelR, centerX, centerY, outerR);
      frameGrad.addColorStop(0, '#6B1515');
      frameGrad.addColorStop(0.3, '#8B2222');
      frameGrad.addColorStop(0.7, '#7A1A1A');
      frameGrad.addColorStop(1, '#4A0A0A');
      ctx.fillStyle = frameGrad;
      ctx.fill();
      ctx.restore();

      // Gold trim outer edge
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerR, 0, TAU);
      ctx.strokeStyle = '#DAA520';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Gold trim inner edge
      ctx.beginPath();
      ctx.arc(centerX, centerY, wheelR + 1, 0, TAU);
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ──── LAYER 2: Light bulbs with chase animation ────

      for (let i = 0; i < NUM_BULBS; i++) {
        const bAngle = (i / NUM_BULBS) * TAU - Math.PI / 2;
        const bx = centerX + Math.cos(bAngle) * bulbRingR;
        const by = centerY + Math.sin(bAngle) * bulbRingR;

        // Chase: groups of 3, cycling at different speeds for spin vs idle
        const group = i % 3;
        const phase = spinning
          ? Math.floor(now / 100) % 3
          : Math.floor(now / 700) % 3;
        const isLit = spinning ? group === phase : true;
        const alpha = spinning ? (isLit ? 1.0 : 0.25) : 0.85;

        // Warm glow halo (lit bulbs only)
        if (isLit) {
          ctx.beginPath();
          ctx.arc(bx, by, bulbDotR * (spinning ? 3.5 : 2.5), 0, TAU);
          const glowG = ctx.createRadialGradient(bx, by, 0, bx, by, bulbDotR * (spinning ? 3.5 : 2.5));
          glowG.addColorStop(0, spinning ? 'rgba(255,220,80,0.7)' : 'rgba(255,200,50,0.4)');
          glowG.addColorStop(1, 'rgba(255,165,0,0)');
          ctx.fillStyle = glowG;
          ctx.fill();
        }

        // Bulb body
        ctx.beginPath();
        ctx.arc(bx, by, bulbDotR, 0, TAU);
        const bGrad = ctx.createRadialGradient(
          bx - bulbDotR * 0.25, by - bulbDotR * 0.25, 0,
          bx, by, bulbDotR
        );
        bGrad.addColorStop(0, `rgba(255,255,230,${alpha})`);
        bGrad.addColorStop(0.4, `rgba(255,215,0,${alpha})`);
        bGrad.addColorStop(1, `rgba(200,140,0,${alpha * 0.7})`);
        ctx.fillStyle = bGrad;
        ctx.fill();
      }

      // ──── LAYER 3: Wheel segments ────

      SEGMENTS.forEach((segment, i) => {
        const startA = normalizedAngle + i * segmentAngle;
        const endA = startA + segmentAngle;

        // ── Segment fill with rich radial gradient ──
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, wheelR - 1, startA, endA);
        ctx.closePath();

        const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, wheelR);
        grad.addColorStop(0, adjustColor(segment.color, 75));
        grad.addColorStop(0.25, adjustColor(segment.color, 45));
        grad.addColorStop(0.65, segment.color);
        grad.addColorStop(1, adjustColor(segment.color, -55));
        ctx.fillStyle = grad;
        ctx.fill();

        // ── Glossy highlight overlay ──
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, wheelR - 1, startA, endA);
        ctx.closePath();
        ctx.clip();

        const midA = startA + segmentAngle / 2;
        const hlX = centerX + Math.cos(midA) * wheelR * 0.35;
        const hlY = centerY + Math.sin(midA) * wheelR * 0.35;
        const glossG = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, wheelR * 0.55);
        glossG.addColorStop(0, 'rgba(255,255,255,0.22)');
        glossG.addColorStop(0.35, 'rgba(255,255,255,0.06)');
        glossG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glossG;
        ctx.fill();
        ctx.restore();

        // ── Gold divider line ──
        ctx.beginPath();
        ctx.moveTo(
          centerX + Math.cos(startA) * (centerHubR + 4),
          centerY + Math.sin(startA) * (centerHubR + 4)
        );
        ctx.lineTo(
          centerX + Math.cos(startA) * (wheelR - 1),
          centerY + Math.sin(startA) * (wheelR - 1)
        );
        ctx.strokeStyle = 'rgba(255,215,0,0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // ── Prize text ──
        const sliceText =
          'wheelLabel' in segment && (segment as { wheelLabel?: string }).wheelLabel != null
            ? (segment as { wheelLabel: string }).wheelLabel
            : segment.label;
        const baseFontSize = Math.max(10, Math.round(size / 26));
        const fontSize = sliceText.length > 10 ? Math.max(8, Math.round(size / 31)) : baseFontSize;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startA + segmentAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Text drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = `bold ${fontSize}px 'Orbitron', sans-serif`;
        ctx.fillText(sliceText, wheelR - Math.max(8, size / 22) + 1, 1);

        // Main text
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = spinning ? 6 : 3;
        ctx.fillText(sliceText, wheelR - Math.max(8, size / 22), 0);
        ctx.shadowBlur = 0;
        ctx.restore();
      });

      // ──── LAYER 4: Inner shadow ring (depth illusion) ────

      ctx.beginPath();
      ctx.arc(centerX, centerY, wheelR - 1, 0, TAU);
      const innerShadow = ctx.createRadialGradient(centerX, centerY, wheelR * 0.82, centerX, centerY, wheelR);
      innerShadow.addColorStop(0, 'rgba(0,0,0,0)');
      innerShadow.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = innerShadow;
      ctx.fill();

      // Gold rim around segments
      ctx.beginPath();
      ctx.arc(centerX, centerY, wheelR - 1, 0, TAU);
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // ──── LAYER 5: Center hub ────

      // Hub outer trim ring (gold)
      ctx.beginPath();
      ctx.arc(centerX, centerY, centerHubR + 5, 0, TAU);
      const hubTrimG = ctx.createRadialGradient(centerX, centerY, centerHubR, centerX, centerY, centerHubR + 5);
      hubTrimG.addColorStop(0, '#FFD700');
      hubTrimG.addColorStop(0.5, '#DAA520');
      hubTrimG.addColorStop(1, '#8B6914');
      ctx.fillStyle = hubTrimG;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Hub body
      ctx.beginPath();
      ctx.arc(centerX, centerY, centerHubR, 0, TAU);
      if (centerColor) {
        const cg = ctx.createRadialGradient(
          centerX - centerHubR * 0.2, centerY - centerHubR * 0.2, 0,
          centerX, centerY, centerHubR
        );
        cg.addColorStop(0, adjustColor(centerColor, 80));
        cg.addColorStop(0.5, centerColor);
        cg.addColorStop(1, adjustColor(centerColor, -50));
        ctx.fillStyle = cg;
      } else {
        const cg = ctx.createRadialGradient(
          centerX - centerHubR * 0.2, centerY - centerHubR * 0.2, 0,
          centerX, centerY, centerHubR
        );
        cg.addColorStop(0, '#FFF8DC');
        cg.addColorStop(0.2, '#FFD700');
        cg.addColorStop(0.6, '#DAA520');
        cg.addColorStop(1, '#8B6914');
        ctx.fillStyle = cg;
      }
      ctx.fill();

      // Hub highlight ring
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Hub specular highlight (tiny bright spot top-left)
      ctx.beginPath();
      ctx.arc(centerX - centerHubR * 0.25, centerY - centerHubR * 0.25, centerHubR * 0.3, 0, TAU);
      const specG = ctx.createRadialGradient(
        centerX - centerHubR * 0.25, centerY - centerHubR * 0.25, 0,
        centerX - centerHubR * 0.25, centerY - centerHubR * 0.25, centerHubR * 0.3
      );
      specG.addColorStop(0, 'rgba(255,255,255,0.35)');
      specG.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = specG;
      ctx.fill();

      // Hub text
      const text = centerLabel != null && centerLabel !== '' ? centerLabel : 'SPIN';
      const hubFontSize = Math.max(9, Math.round(centerHubR * 0.62));
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${hubFontSize}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      ctx.fillText(text, centerX, centerY);
      ctx.shadowBlur = 0;
    },
    [size, centerX, centerY, wheelR, outerR, bulbRingR, bulbDotR, centerHubR, adjustColor]
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
        bonusSpins: data.bonusSpins,
      };

      // Refresh spin status (remaining spins / bonus count)
      fetchSpinStatus();

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
  }, [startAnimLoop, calculateTargetAngle, fetchSpinStatus]);

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

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ─── Floating Button ─── */}
      <div className="fixed z-[100] top-1/2 -translate-y-[calc(50%-2px)] right-4 sm:right-6">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center p-1.5 bg-transparent hover:scale-110 active:scale-95 transition-transform touch-manipulation min-w-[60px] min-h-[60px] sm:min-w-[72px] sm:min-h-[72px]"
          aria-label="Open Wheel of Fortune"
        >
          <img src="/WHeels.png" alt="" className="w-[100px] h-[100px] object-contain drop-shadow-md" />
        </button>
      </div>

      {/* ─── Wheel Modal ─── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-contain"
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
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
          {/* ── Spotlight beams ── */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="casino-spotlight-left"
              style={{
                position: 'absolute',
                top: '-15%',
                left: '-5%',
                width: '50%',
                height: '130%',
                background: 'linear-gradient(155deg, rgba(255,255,200,0.10) 0%, rgba(255,255,200,0.03) 30%, transparent 55%)',
                transform: 'rotate(-2deg)',
                filter: 'blur(25px)',
              }}
            />
            <div
              className="casino-spotlight-right"
              style={{
                position: 'absolute',
                top: '-15%',
                right: '-5%',
                width: '50%',
                height: '130%',
                background: 'linear-gradient(205deg, rgba(255,255,200,0.10) 0%, rgba(255,255,200,0.03) 30%, transparent 55%)',
                transform: 'rotate(2deg)',
                filter: 'blur(25px)',
              }}
            />
          </div>

          {/* ── Sparkle particles ── */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {particles.map(p => (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  left: `${p.left}%`,
                  bottom: '8%',
                  width: p.size,
                  height: p.size,
                  background: 'radial-gradient(circle, #FFD700, #FF8C00)',
                  opacity: 0,
                  animation: `sparkleFloat ${p.duration}s ${p.delay}s ease-in-out infinite`,
                  boxShadow: '0 0 3px 1px rgba(255,215,0,0.5)',
                }}
              />
            ))}
          </div>

          {/* ── Main content wrapper ── */}
          <div
            className="relative flex-shrink-0 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Wheel container */}
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
                className="absolute -top-10 sm:-top-12 right-0 text-white/70 hover:text-white active:text-gray-400 transition-colors z-10 p-3 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center touch-manipulation"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Warm radial glow behind wheel */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: size * 1.35,
                  height: size * 1.35,
                  background: isSpinning
                    ? 'radial-gradient(circle, rgba(255,180,30,0.30) 0%, rgba(200,50,0,0.18) 35%, transparent 68%)'
                    : 'radial-gradient(circle, rgba(255,180,30,0.14) 0%, rgba(200,50,0,0.08) 35%, transparent 68%)',
                  filter: 'blur(18px)',
                  transition: 'all 0.6s ease',
                  animation: isSpinning ? 'casinoGlow 1.5s ease-in-out infinite' : 'none',
                }}
              />

              {/* Golden pointer (SVG) */}
              <div
                className="absolute left-1/2 z-10 pointer-events-none"
                style={{ top: -4, transform: 'translateX(-50%)' }}
              >
                <svg
                  width={size < 380 ? 26 : 34}
                  height={size < 380 ? 34 : 44}
                  viewBox="0 0 34 44"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                >
                  <defs>
                    <linearGradient id="ptrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFF8DC" />
                      <stop offset="30%" stopColor="#FFD700" />
                      <stop offset="70%" stopColor="#DAA520" />
                      <stop offset="100%" stopColor="#8B6914" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points="17,44 2,6 17,14 32,6"
                    fill="url(#ptrGrad)"
                    stroke="#B8860B"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={size}
                height={size}
                className="relative z-[1] cursor-pointer touch-manipulation"
                style={{
                  filter: isSpinning
                    ? 'drop-shadow(0 0 25px rgba(255,170,0,0.5)) drop-shadow(0 0 50px rgba(180,20,0,0.35))'
                    : 'drop-shadow(0 0 12px rgba(255,170,0,0.25))',
                  transition: 'filter 0.6s ease',
                }}
                onClick={handleSpinClick}
              />

              {/* Login Modal */}
              {showLoginModal && (
                <div className="absolute inset-0 bg-black bg-opacity-90 rounded-full flex items-center justify-center z-30 p-3 sm:p-4">
                  <div className="bg-gradient-to-br from-red-900 to-red-700 rounded-2xl p-5 sm:p-8 text-center max-w-xs w-full mx-2 sm:mx-4 border border-yellow-600/30">
                    <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔒</div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                      Sign In Required
                    </h3>
                    <p className="text-white/90 text-sm sm:text-base mb-4 sm:mb-6">
                      Please sign in to spin the wheel!
                    </p>
                    <div className="flex gap-3 sm:gap-4 flex-col sm:flex-row">
                      <button
                        onClick={() => setShowLoginModal(false)}
                        className="flex-1 min-h-[44px] px-4 py-3 sm:py-2 bg-gray-700 text-white font-semibold rounded-full hover:bg-gray-600 active:bg-gray-800 transition-colors touch-manipulation"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setShowLoginModal(false);
                          navigate('/login');
                        }}
                        className="flex-1 min-h-[44px] px-4 py-3 sm:py-2 font-semibold rounded-full transition-colors flex items-center justify-center gap-2 touch-manipulation text-black"
                        style={{
                          background: 'linear-gradient(135deg, #FFD700, #FFA000)',
                          boxShadow: '0 0 12px rgba(255,215,0,0.3)',
                        }}
                      >
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Spin count badge removed — the wheel itself communicates availability */}

          </div>

          {/* ─── Result card ─── */}
          {showResult &&
            lastResult &&
            (() => {
              const actualSegment =
                lastResult.sliceOrder != null
                  ? SEGMENTS[Math.max(0, Math.min(lastResult.sliceOrder, SEGMENTS.length - 1))]
                  : SEGMENTS.find((s) => s.type === lastResult.rewardType) || SEGMENTS[0];
              return (
                <div
                  className="fixed z-[60] max-w-[280px] sm:max-w-sm mx-auto rounded-xl sm:rounded-2xl px-3 py-2.5 sm:p-6 text-center"
                  style={{
                    bottom: 'max(7rem, calc(6rem + env(safe-area-inset-bottom)))',
                    left: 'max(1rem, env(safe-area-inset-left))',
                    right: 'max(1rem, env(safe-area-inset-right))',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    background: 'linear-gradient(135deg, #4A0000 0%, #8B0000 50%, #4A0000 100%)',
                    border: '1px solid rgba(255,215,0,0.3)',
                    boxShadow:
                      '0 0 30px rgba(139,0,0,0.5), 0 0 15px rgba(255,215,0,0.15), 0 4px 20px rgba(0,0,0,0.4)',
                    animation: 'resultAppear 0.4s ease-out',
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
                      className="min-h-[40px] sm:min-h-[44px] px-3 py-2 sm:px-5 sm:py-2.5 bg-white/90 text-[#0A0A0F] font-bold text-sm sm:text-base rounded-full hover:scale-105 active:scale-95 transition-transform touch-manipulation"
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
                        boxShadow: '0 0 15px rgba(255,215,0,0.3)',
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

      {/* ─── Keyframe animations ─── */}
      <style>{`
        @keyframes sparkleFloat {
          0%   { transform: translateY(0) scale(0); opacity: 0; }
          12%  { transform: translateY(-15px) scale(1); opacity: 0.75; }
          85%  { opacity: 0.5; }
          100% { transform: translateY(-220px) scale(0.3); opacity: 0; }
        }
        @keyframes casinoGlow {
          0%, 100% {
            opacity: 0.7;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.06);
          }
        }
        @keyframes resultAppear {
          0%   { transform: translateY(20px) scale(0.92); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes neonFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </>
  );
}
