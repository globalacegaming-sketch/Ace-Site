'use client';

// ============================================
// COSMIC SPINNER - WHEEL COMPONENT
// ============================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, LogIn } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getApiBaseUrl } from '../../utils/api';

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
  sliceOrder?: number; // Order/index of the winning slice
  targetAngle?: number; // Angle to land on winning segment
}

// Fixed segment order - no random shuffle
// Order: 1, 5, free spin +1, 1, better luck, 10, better luck, 5, 1, free spin +1, 50%, better luck, 1, 5, better luck
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

interface WheelProps {
  size?: number;
}

export default function Wheel({ size: initialSize = 500 }: WheelProps) {
  // Responsive size: small phones (<400), phones (400–768), desktop (768+)
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
  const { isAuthenticated, token, checkSession, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [config, setConfig] = useState<WheelConfig | null>(null);
  const [segments] = useState(SEGMENTS); // Always use hardcoded segments
  
  // Local state for wheel animation
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const API_BASE_URL = getApiBaseUrl();

  // Hide on admin/agent pages and on login/signup (auth) pages
  const isAdminOrAgentPage = location.pathname.startsWith('/aceadmin') || 
                             location.pathname.startsWith('/aceagent');
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  // Handle responsive sizing (match initial logic)
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let newSize: number;
      if (w < 400) newSize = Math.max(260, Math.min(w - 16, 320));
      else if (w < 768) newSize = Math.min(w - 24, 360);
      else newSize = initialSize;
      setWheelSize(newSize);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialSize]);

  // No longer loading slices from backend - using hardcoded SEGMENTS

  // Load wheel configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configResponse = await axios.get(`${API_BASE_URL}/wheel/config`);
        
        if (configResponse.data.success) {
          setConfig(configResponse.data.data);
        }
      } catch (error) {
        console.error('Failed to load wheel config:', error);
      }
    };

    if (!isAdminOrAgentPage && !isAuthPage) {
      loadConfig();
    }
  }, [API_BASE_URL, isAdminOrAgentPage, isAuthPage]);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 10;

  // Which slice is under the pointer at 12 o'clock. Matches ref: getIndex = () => Math.floor(tot - (ang/TAU)*tot) % tot.
  // Our wheel is drawn with segments at [angle + i*arc, angle + (i+1)*arc]; 12 o'clock = 3π/2 => i = floor((3π/2 - angle) / arc).
  const getIndex = useCallback((angle: number): number => {
    const TAU = 2 * Math.PI;
    const tot = segments.length;
    const arc = TAU / tot;
    const normalized = ((angle % TAU) + TAU) % TAU;
    const r = (3 * Math.PI / 2 - normalized + TAU) % TAU;
    return Math.floor(r / arc) % tot;
  }, [segments.length]);

  // Adjust color brightness
  const adjustColor = useCallback((color: string, amount: number): string => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  // Draw the wheel. centerLabel/centerColor: show winning (or current) slice in center like the reference (SPIN | sector.label + sector.color).
  const drawWheel = useCallback((angle: number, isSpinning: boolean = false, centerLabel?: string | null, centerColor?: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    
    // Normalize angle for drawing (0 to 2π)
    const normalizedAngle = ((angle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

    const segmentAngle = (2 * Math.PI) / segments.length;
    
    // Enhanced neon glow intensity when spinning
    const glowIntensity = isSpinning ? 25 : 15;
    const borderGlow = isSpinning ? 12 : 8;
    
    // Draw segments
    segments.forEach((segment, i) => {
      const startAngle = normalizedAngle + i * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      // Enhanced gradient fill with neon effect
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius
      );
      gradient.addColorStop(0, adjustColor(segment.color, isSpinning ? 60 : 40));
      gradient.addColorStop(0.6, segment.color);
      gradient.addColorStop(1, adjustColor(segment.color, -40));
      ctx.fillStyle = gradient;
      ctx.fill();

      // Enhanced segment border with neon glow
      ctx.strokeStyle = isSpinning ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = isSpinning ? 3 : 2;
      ctx.shadowColor = segment.color;
      ctx.shadowBlur = borderGlow;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Highlight winning slice: strong golden glow and brighter fill so it’s obvious
      // Draw text with enhanced glow when spinning. Use wheelLabel when present for slice text.
      const sliceText = 'wheelLabel' in segment && (segment as { wheelLabel?: string }).wheelLabel != null
        ? (segment as { wheelLabel: string }).wheelLabel
        : segment.label;
      const baseFontSize = Math.max(11, Math.round(size / 22));
      const fontSize = sliceText.length > 10 ? Math.max(9, Math.round(size / 26)) : baseFontSize;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize}px 'Orbitron', monospace`;
      ctx.shadowColor = isSpinning ? segment.color : 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = isSpinning ? 8 : 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(sliceText, radius - Math.max(8, size / 28), 0);
      ctx.restore();
    });

    // Enhanced outer glow ring with pulsing effect when spinning
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 3, 0, 2 * Math.PI);
    const glowColor = isSpinning ? '#00ffff' : '#00ffff';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = isSpinning ? 4 : 3;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowIntensity;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Additional outer neon ring when spinning
    if (isSpinning) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw center circle: SPIN or winning/current slice label; fill = slice color when provided (like #spin in ref).
    const centerRad = size / 12;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerRad, 0, 2 * Math.PI);
    if (centerColor) {
      ctx.fillStyle = centerColor;
      ctx.shadowColor = centerColor;
    } else {
      const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, centerRad);
      centerGradient.addColorStop(0, '#FF1493');
      centerGradient.addColorStop(0.5, '#FF69B4');
      centerGradient.addColorStop(1, '#DA70D6');
      ctx.fillStyle = centerGradient;
      ctx.shadowColor = '#FF1493';
    }
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    const centerText = (centerLabel != null && centerLabel !== '') ? centerLabel : 'SPIN';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(12, Math.round(size / 18))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(centerText, centerX, centerY);
    ctx.shadowBlur = 0;
  }, [size, centerX, centerY, radius, adjustColor, segments]);

  // Animate the spin. winningLabel/winningColor: exact values for center when stopped. onComplete: called when wheel stops (result shown on card only).
  const animateSpin = useCallback((
    startAngle: number,
    targetAngle: number,
    duration: number,
    startTime: number,
    _winningSliceIndex: number | null,
    winningLabel: string,
    winningColor: string,
    onComplete?: () => void
  ) => {
    // Normalize start and target angles to 0-2π range
    const normalizedStart = ((startAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    const normalizedTarget = ((targetAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Add multiple full rotations for dramatic effect (5-8 full rotations)
    const fullRotations = 5 + Math.random() * 3; // 5-8 rotations
    // Calculate the shortest path to target, then add rotations
    let angleDiff = normalizedTarget - normalizedStart;
    if (angleDiff < 0) angleDiff += 2 * Math.PI; // Ensure positive difference
    const totalRotation = normalizedStart + angleDiff + (fullRotations * 2 * Math.PI);
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Single smooth ease-out: fast spin that naturally decelerates to a stop. No phases or
      // kinks—feels like real momentum so it doesn’t feel rigged. Quintic = gradual slowdown.
      const E = 0.72;
      let eased: number;
      if (progress <= 0.5) {
        const u = progress / 0.5;
        eased = E * u * u;
      } else {
        const s = (progress - 0.5) / 0.5;
        eased = E * (4 * s * s * s - 7 * s * s + 2 * s + 1) + (-2 * s * s * s + 3 * s * s);
      }
      const totalAngle = totalRotation - normalizedStart;
      const newAngle = normalizedStart + totalAngle * (progress >= 0.99 ? 1 : eased);
      setCurrentAngle(newAngle);
      const drawAngle = progress >= 0.99 ? normalizedTarget : newAngle;
      const idx = getIndex(drawAngle);
      drawWheel(drawAngle, true, segments[idx].label, segments[idx].color);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = normalizedTarget;
        setCurrentAngle(finalAngle);
        isAnimatingRef.current = false;
        setIsSpinning(false);
        animationRef.current = null;
        // Draw final frame with winning slice highlighted (no pointer, highlight is the source of truth)
        drawWheel(finalAngle, false, winningLabel, winningColor);
        // Show result card immediately so it’s visible with the highlighted wheel
        setShowResult(true);
        onComplete?.();
      }
    };

    animate();
  }, [drawWheel, getIndex, segments]);

  // Reset animation flag when lastResult is cleared
  useEffect(() => {
    if (!lastResult) {
      isAnimatingRef.current = false;
    }
  }, [lastResult]);

  // Start spin animation when we get a result
  useEffect(() => {
    if (isSpinning && lastResult && !isAnimatingRef.current && lastResult.targetAngle !== undefined) {
      isAnimatingRef.current = true;

      const startAngle = currentAngle;
      const targetAngle = lastResult.targetAngle;
      const duration = 5000; // 5 seconds for smoother, more precise animation
      const winningSlice = lastResult.sliceOrder ?? null;

      const onComplete = () => { /* result shown on card only, no toast */ };
      animateSpin(startAngle, targetAngle, duration, Date.now(), winningSlice, lastResult.rewardLabel, lastResult.rewardColor, onComplete);

      // Safety timeout - if animation doesn't complete, reset and show result + toast
      const safetyTimeout = setTimeout(() => {
        if (isAnimatingRef.current || isSpinning) {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          isAnimatingRef.current = false;
          setIsSpinning(false);
          if (!showResult) {
            setShowResult(true);
            onComplete();
          }
        }
      }, duration + 500);

      return () => {
        clearTimeout(safetyTimeout);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isSpinning, lastResult, animateSpin]);

  // Center: when we have lastResult use rewardLabel/rewardColor (same as toast). Else when spinning use slice under pointer; else SPIN.
  const centerLabel = (showResult && lastResult != null)
    ? lastResult.rewardLabel
    : isSpinning
      ? segments[getIndex(currentAngle)].label
      : 'SPIN';
  const centerColor = (showResult && lastResult != null)
    ? lastResult.rewardColor
    : isSpinning
      ? segments[getIndex(currentAngle)].color
      : undefined;

  // Draw wheel. When we have a result: use lastResult.targetAngle so pointer always points at winning slice; skip during main anim (animate owns it).
  useEffect(() => {
    if (!isOpen) return;
    if (isAnimatingRef.current) return;

    const drawAngle = (showResult && lastResult != null && lastResult.targetAngle != null)
      ? lastResult.targetAngle
      : currentAngle;
    drawWheel(drawAngle, isSpinning, centerLabel, centerColor ?? null);
  }, [currentAngle, drawWheel, isOpen, isSpinning, segments, showResult, lastResult, centerLabel, centerColor, getIndex]);

  // Calculate target angle from reward type
  const calculateTargetAngle = (sliceOrder?: number, rewardType?: string): number => {
    let winningSegmentIndex: number;
    
    // If sliceOrder is provided, use it directly (most accurate)
    if (sliceOrder !== undefined && sliceOrder !== null) {
      winningSegmentIndex = sliceOrder;
    } else if (rewardType) {
      // Fallback: Find first segment with matching reward type
      const index = segments.findIndex(seg => seg.type === rewardType);
      winningSegmentIndex = index >= 0 ? index : 0;
    } else {
      winningSegmentIndex = 0; // Default to first segment
    }
    
    // Ensure index is within bounds
    winningSegmentIndex = Math.max(0, Math.min(winningSegmentIndex, segments.length - 1));
    
    const segmentAngle = (2 * Math.PI) / segments.length;
    
    // Calculate angle to center the winning segment under the pointer at the TOP.
    // In canvas: 0 = right, π/2 = bottom, π = left, -π/2 (3π/2) = top where the pointer is.
    // Segment i center in wheel coords: (i + 0.5) * segmentAngle. In world coords: angle + (i + 0.5) * segmentAngle.
    // We need: angle + (i + 0.5) * segmentAngle = -π/2 (mod 2π)  =>  angle = 3π/2 - (i + 0.5) * segmentAngle
    const targetSegmentCenterAngle = winningSegmentIndex * segmentAngle + segmentAngle / 2;
    const targetAngle = (3 * Math.PI / 2) - targetSegmentCenterAngle;

    // Normalize to 0-2π range
    return ((targetAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
  };

  const handleSpinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    // Allow clicking even if already spinning (will be handled by API)
    if (isAnimatingRef.current) return;

    // Check session validity
    if (!checkSession()) {
      logout();
      toast.error('Your session has expired. Please login again.');
      return;
    }

    // Result is determined as soon as we have constraints; we animate directly to that target.
    // No intermediate "quick spin" — one smooth motion from current position to the result.
    setIsSpinning(true);
    setShowResult(false);
    setLastResult(null);

    try {
      // Step 1: Get budget constraints from backend (which segments are allowed)
      const constraintsResponse = await axios.get(
        `${API_BASE_URL}/wheel/spin-constraints`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!constraintsResponse.data.success) {
        throw new Error(constraintsResponse.data.message || 'Failed to get spin constraints');
      }

      const { allowedSegmentIndices } = constraintsResponse.data.data;

      if (!allowedSegmentIndices || allowedSegmentIndices.length === 0) {
        throw new Error('No segments available (budget exhausted)');
      }

      // Step 2: Frontend randomly selects from allowed segments
      const randomIndex = Math.floor(Math.random() * allowedSegmentIndices.length);
      const selectedSegmentIndex = allowedSegmentIndices[randomIndex];
      const selectedSegment = SEGMENTS[selectedSegmentIndex];

      // Step 3: Calculate target angle for animation
      const targetAngle = calculateTargetAngle(selectedSegmentIndex, selectedSegment.type);

      // Step 4: Create result object
      const result: SpinResult = {
        spinId: '', // Will be set after backend records it
        sliceOrder: selectedSegmentIndex,
        rewardType: selectedSegment.type,
        rewardLabel: selectedSegment.label,
        rewardValue: selectedSegment.type.startsWith('bonus_') ? selectedSegment.label : null,
        rewardColor: selectedSegment.color,
        bonusSent: false,
        targetAngle: targetAngle
      };

      // Step 5: Send result to backend for recording
      const recordResponse = await axios.post(
        `${API_BASE_URL}/wheel/spin`,
        {
          sliceOrder: selectedSegmentIndex,
          rewardType: selectedSegment.type,
          rewardLabel: selectedSegment.label
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (recordResponse.data.success) {
        // Update result with backend data
        result.spinId = recordResponse.data.data.spinId;
        result.bonusSent = recordResponse.data.data.bonusSent;
        result.messageId = recordResponse.data.data.messageId;

        setLastResult(result);
        // Result is shown on the result card when the wheel stops (center and card show the same result).
      } else {
        throw new Error(recordResponse.data.message || 'Failed to record spin result');
      }
    } catch (error: any) {
      // Stop any ongoing animation (e.g. if we had started before an error)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      setIsSpinning(false);
      isAnimatingRef.current = false;
      
      // Reset wheel: SPIN in center, default gradient (no slice highlight)
      drawWheel(currentAngle, false, 'SPIN', null);
      
      if (error.response?.status === 401) {
        logout();
        toast.error('Your session has expired. Please login again.');
      } else if (error.response?.status === 400) {
        const errorMessage = error.response.data.message || 'Unable to spin the wheel';
        // One toast only: use prominent message for "no spins left", otherwise the API message
        if (errorMessage.includes('already used') || errorMessage.includes('spin limit')) {
          toast.error('You have used all your spins!', { duration: 5000, icon: '⚠️' });
        } else {
          toast.error(errorMessage, { duration: 4000 });
        }
      } else {
        toast.error('Failed to spin the wheel. Please try again.');
      }
    }
  };

  // Don't show on admin/agent pages, login/signup, while config is loading, or when explicitly disabled.
  // Hide until we have config to avoid flash of wheel when it's off.
  if (isAdminOrAgentPage || isAuthPage || !config || config.isEnabled === false) {
    return null;
  }

  return (
    <>
      {/* Floating Button - Center-right of screen, visible on all devices including mobile */}
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
            background: 'radial-gradient(circle at center, rgba(0, 20, 40, 0.95) 0%, rgba(0, 0, 0, 0.98) 100%)',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(5rem, calc(4rem + env(safe-area-inset-bottom)))'
          }}
          onClick={() => {
            if (!isSpinning && !isAnimatingRef.current) {
              setIsOpen(false);
              setShowResult(false);
              setShowLoginModal(false);
              // Reset all spin-related states when closing modal
              setLastResult(null);
              setIsSpinning(false);
              isAnimatingRef.current = false;
            }
          }}
        >
          <div 
            className="relative flex-shrink-0 flex flex-col items-center -translate-y-10 sm:translate-y-0"
            style={{ width: size }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Wheel and overlay elements */}
            <div className="relative" style={{ width: size, height: size, minWidth: size, minHeight: size }}>
            {/* Close Button – 44px touch target on mobile */}
            <button
              onClick={() => {
                setIsOpen(false);
                setShowResult(false);
                setShowLoginModal(false);
                setLastResult(null);
                setIsSpinning(false);
                isAnimatingRef.current = false;
              }}
              className="absolute -top-10 sm:-top-12 right-0 sm:right-0 text-white hover:text-gray-300 active:text-gray-400 transition-colors z-10 p-3 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center touch-manipulation"
              aria-label="Close"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Enhanced glow effect behind wheel - pulses when spinning */}
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

            {/* Pointer at top – scales down on small wheels */}
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

            {/* Canvas with dynamic neon glow */}
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

          {/* Result card – fixed at bottom so it’s always visible; winning slice is highlighted on the wheel */}
          {showResult && lastResult && (() => {
              const actualSegment = lastResult.sliceOrder != null
                ? SEGMENTS[Math.max(0, Math.min(lastResult.sliceOrder, SEGMENTS.length - 1))]
                : SEGMENTS.find(s => s.type === lastResult.rewardType) || SEGMENTS[0];
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
                    boxShadow: '0 0 30px rgba(106, 27, 154, 0.4), 0 0 20px rgba(0, 176, 255, 0.25), 0 4px 20px rgba(0,0,0,0.3)',
                    animation: 'neonFlicker 0.5s ease-in-out'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-3xl sm:text-5xl mb-1 sm:mb-3">
                    {actualSegment.type === 'better_luck' ? '😔' :
                     actualSegment.type === 'try_again' ? '🔄' : '🎉'}
                  </div>
                  <h3 className="text-lg sm:text-3xl font-bold text-white mb-0.5 sm:mb-2">
                    {lastResult.rewardLabel}
                  </h3>
                  {actualSegment.type === 'better_luck' && (
                    <p className="text-white/90 text-xs sm:text-base mb-2 sm:mb-4">Better luck next time!</p>
                  )}
                  {actualSegment.type === 'try_again' && (
                    <p className="text-white/90 text-xs sm:text-base mb-2 sm:mb-4">You get an extra spin!</p>
                  )}
                  {actualSegment.type.startsWith('bonus_') && (
                    <p className="text-white/90 text-xs sm:text-base mb-2 sm:mb-4">Your bonus has been sent to your chat!</p>
                  )}
                  <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
                    <button
                      onClick={() => {
                        setShowResult(false);
                        setLastResult(null);
                        setIsSpinning(false);
                        isAnimatingRef.current = false;
                        if (animationRef.current) {
                          cancelAnimationFrame(animationRef.current);
                          animationRef.current = null;
                        }
                      }}
                      className="min-h-[40px] sm:min-h-[44px] px-3 py-2 sm:px-5 sm:py-2.5 bg-white/95 text-[#0A0A0F] font-bold text-sm sm:text-base rounded-full hover:scale-105 active:scale-95 transition-transform touch-manipulation"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setShowResult(false);
                        setLastResult(null);
                        setIsSpinning(false);
                        isAnimatingRef.current = false;
                        if (animationRef.current) {
                          cancelAnimationFrame(animationRef.current);
                          animationRef.current = null;
                        }
                        setTimeout(() => {
                          handleSpinClick({ stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent);
                        }, 100);
                      }}
                      className="min-h-[40px] sm:min-h-[44px] px-3 py-2 sm:px-5 sm:py-2.5 font-bold text-sm sm:text-base rounded-full border-2 border-[#FFD700] hover:scale-105 active:scale-95 transition-transform touch-manipulation"
                      style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)', color: '#0A0A0F', boxShadow: '0 0 15px rgba(255, 215, 0, 0.3)' }}
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
          0% { 
            filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.5));
          }
          25% { 
            filter: drop-shadow(0 0 40px rgba(255, 0, 255, 0.8));
          }
          50% { 
            filter: drop-shadow(0 0 30px rgba(0, 255, 255, 0.9));
          }
          75% { 
            filter: drop-shadow(0 0 50px rgba(255, 255, 0, 0.7));
          }
          100% { 
            filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.5));
          }
        }
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
      `}</style>
    </>
  );
}
