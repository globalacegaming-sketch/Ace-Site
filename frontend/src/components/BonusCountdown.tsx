import { useState, useEffect } from 'react';

interface Props {
  validUntil: string;
}

function getTimeLeft(target: number) {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, total: diff };
}

/**
 * Live countdown for bonuses expiring within 7 days.
 * Turns red/orange when < 24h remain.
 */
export default function BonusCountdown({ validUntil }: Props) {
  const target = new Date(validUntil).getTime();
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => {
      const tl = getTimeLeft(target);
      setTimeLeft(tl);
      if (!tl) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!timeLeft) return <span className="text-xs text-red-400 font-medium">Expired</span>;

  // Don't show countdown if more than 7 days away
  const SEVEN_DAYS = 7 * 86400000;
  if (timeLeft.total > SEVEN_DAYS) return null;

  const isUrgent = timeLeft.total < 86400000; // < 24h

  let label: string;
  if (timeLeft.days > 0) {
    label = `Expires in ${timeLeft.days}d ${timeLeft.hours}h`;
  } else if (timeLeft.hours > 0) {
    label = `Expires in ${timeLeft.hours}h ${timeLeft.minutes}m`;
  } else {
    label = `Expires in ${timeLeft.minutes}m ${timeLeft.seconds}s`;
  }

  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        isUrgent
          ? 'bg-red-500/20 text-red-400'
          : 'bg-orange-500/20 text-orange-400'
      }`}
    >
      {label}
    </span>
  );
}
