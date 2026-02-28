import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

/**
 * Splits text and returns an array of strings and React nodes.
 * URLs are rendered as clickable <a> links that open in a new tab.
 * Supports http://, https://, and www. links.
 */
export function linkify(
  text: string,
  opts?: {
    linkClassName?: string;
    trimTrailingPunctuation?: boolean;
  }
): (string | React.ReactNode)[] {
  if (!text || typeof text !== 'string') return [text || ''];

  const { linkClassName = 'underline text-indigo-600 hover:text-indigo-800 break-all', trimTrailingPunctuation = true } = opts ?? {};

  const parts = text.split(URL_REGEX);

  return parts.map((part, i) => {
    const isHttpUrl = part.startsWith('http://') || part.startsWith('https://');
    const isWwwUrl = part.toLowerCase().startsWith('www.');
    const isUrl = isHttpUrl || isWwwUrl;
    if (isUrl) {
      let href = part;
      if (trimTrailingPunctuation) {
        href = part.replace(/[.,;:!?)\]'"]+$/, '');
      }
      if (isWwwUrl && !href.startsWith('http')) {
        href = 'https://' + href;
      }
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
