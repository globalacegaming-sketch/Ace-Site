/**
 * Chat is the hub for money. These helpers build the message that gets typed
 * into the chat composer when a player taps Deposit / Withdraw / Bonus help.
 *
 * Logged-in users: `navigate('/chat', { state: { prefill } })`.
 * Guests: `navigate('/login', { state: { from: chatPathWithPrefill(msg) } })` —
 * Login already redirects to `state.from` after sign-in.
 */

export const CHAT_PREFILL_PARAM = 'prefill';

export const chatMessages = {
  deposit: 'Hi, I would like to make a deposit. Please let me know the payment options.',
  withdraw: 'Hi, I would like to withdraw from my balance. Please let me know the next steps.',
  bonusHelp: 'Hi, I need help with a bonus I claimed.',
  platformDeposit: (platformName: string) =>
    `Hi, I would like to deposit for ${platformName}. Please let me know the payment options.`,
} as const;

/** `/chat?prefill=...` — usable as a plain URL (e.g. for Login's `from` redirect). */
export function chatPathWithPrefill(message: string): string {
  return `/chat?${CHAT_PREFILL_PARAM}=${encodeURIComponent(message)}`;
}

export type ChatPrefillState = { prefill?: string } | null | undefined;
