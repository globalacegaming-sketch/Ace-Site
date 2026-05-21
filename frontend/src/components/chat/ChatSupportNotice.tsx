import { Headphones } from 'lucide-react';

type Props = {
  variant?: 'dark' | 'light';
};

/**
 * Shown when a user opens live chat with no message history yet.
 */
export function ChatSupportNotice({ variant = 'dark' }: Props) {
  const light = variant === 'light';

  return (
    <div
      className={`rounded-2xl border px-4 py-4 text-center ${
        light
          ? 'border-indigo-200 bg-indigo-50'
          : 'casino-border border-[color:var(--casino-card-border)] bg-black/25'
      }`}
    >
      <Headphones
        className={`mx-auto mb-3 h-10 w-10 ${light ? 'text-indigo-600' : 'text-[color:var(--casino-highlight-gold)]'}`}
        aria-hidden
      />
      <p
        className={`text-base font-bold leading-snug sm:text-lg ${
          light ? 'text-gray-900' : 'casino-text-primary'
        }`}
      >
        Text us now for Live Support
      </p>
      <p
        className={`mt-2 text-sm leading-relaxed ${
          light ? 'text-gray-600' : 'casino-text-secondary'
        }`}
      >
        We are closed <span className="font-semibold">12pm to 6pm CST</span> and available
        outside those hours.
      </p>
    </div>
  );
}
