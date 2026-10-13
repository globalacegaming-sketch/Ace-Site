import { HTMLElement, Node, NodeType, TextNode, parse } from 'node-html-parser';

const COLORS = {
  primaryDark: '#0A0A0F',
  highlightGold: '#FFD700',
  accentCyan: '#00E5FF',
  textPrimary: '#F5F5F5',
  textSecondary: '#B0B0B0',
  border: '#2C2C3A',
} as const;

const TEXT =
  `font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:${COLORS.textPrimary};`;

const FONT_CANONICAL: Record<string, string> = {
  'arial, helvetica, sans-serif': 'Arial, Helvetica, sans-serif',
  'georgia, serif': 'Georgia, serif',
  'verdana, geneva, sans-serif': 'Verdana, Geneva, sans-serif',
  'courier new, courier, monospace': "'Courier New', Courier, monospace",
};

const COLOR_CANONICAL: Record<string, string> = {
  '#f5f5f5': COLORS.textPrimary,
  '#ffd700': COLORS.highlightGold,
  '#b0b0b0': COLORS.textSecondary,
  '#00e5ff': COLORS.accentCyan,
};

const FONT_SIZES = new Set(['14px', '16px', '20px', '24px', '28px']);
const ALIGNS = new Set(['left', 'center', 'right']);
const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'head', 'title', 'svg', 'form',
]);

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tagOf(el: HTMLElement): string {
  return (el.rawTagName || el.tagName || '').toLowerCase();
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

function parseStyle(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const part of style.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

function normalizeFont(value: string): string | null {
  const key = value.toLowerCase().replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  return FONT_CANONICAL[key] || null;
}

function normalizeColor(value: string): string | null {
  const key = value.toLowerCase().replace(/\s+/g, '');
  return COLOR_CANONICAL[key] || null;
}

function allowedImageOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const raw of [process.env.API_PUBLIC_URL, process.env.BACKEND_URL]) {
    if (!raw) continue;
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // ignore malformed env values
    }
  }
  return origins;
}

function isAllowedImageSrc(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    return allowedImageOrigins().has(url.origin);
  } catch {
    return false;
  }
}

function isAllowedHref(href: string): boolean {
  const trimmed = href.trim();
  if (/^mailto:/i.test(trimmed)) {
    return /^mailto:[^<>\s"]+$/i.test(trimmed);
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function alignFrom(el: HTMLElement): string {
  const align = (parseStyle(el.getAttribute('style'))['text-align'] || '').toLowerCase();
  if (!align || !ALIGNS.has(align) || align === 'left') return '';
  return `text-align:${align};`;
}

function spanStyle(el: HTMLElement): string {
  const style = parseStyle(el.getAttribute('style'));
  const parts: string[] = [];
  const font = style['font-family'] ? normalizeFont(style['font-family']) : null;
  const color = style.color ? normalizeColor(style.color) : null;
  const size = style['font-size']?.toLowerCase().replace(/\s+/g, '');
  if (font) parts.push(`font-family:${font}`);
  if (size && FONT_SIZES.has(size)) parts.push(`font-size:${size}`);
  if (color) parts.push(`color:${color}`);
  return parts.join(';');
}

function buttonHtml(href: string, label: string): string {
  const bg = COLORS.highlightGold;
  const textColor = COLORS.primaryDark;
  const safeHref = escapeText(href);
  const safeLabel = escapeText(label || 'Open');
  return `
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:8px auto 16px;">
  <tr>
    <td align="center" style="border-radius:8px;background-color:${bg};">
      <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:${textColor};text-decoration:none;border-radius:8px;background-color:${bg};">${safeLabel}</a>
    </td>
  </tr>
</table>`.trim();
}

function imageHtml(el: HTMLElement): string {
  const src = (el.getAttribute('src') || '').trim();
  if (!isAllowedImageSrc(src)) return '';
  const alt = escapeText(el.getAttribute('alt') || '');
  const safeSrc = escapeText(src);
  return `
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
  <tr>
    <td align="center" style="padding:0;">
      <img src="${safeSrc}" alt="${alt}" width="536" style="display:block;margin:0 auto;max-width:100%;width:100%;height:auto;border:0;" />
    </td>
  </tr>
</table>`.trim();
}

function renderChildren(nodes: Node[]): string {
  return nodes.map((node) => renderNode(node)).join('');
}

function paragraphHtml(el: HTMLElement): string {
  const chunks: string[] = [];
  let inline: Node[] = [];
  const flush = () => {
    const inner = renderChildren(inline).trim();
    inline = [];
    if (!inner) return;
    chunks.push(
      `<p style="margin:0 0 16px;${TEXT}${alignFrom(el)}">${inner}</p>`
    );
  };

  for (const child of el.childNodes) {
    if (isElement(child) && tagOf(child) === 'img') {
      flush();
      chunks.push(imageHtml(child));
    } else if (isElement(child) && tagOf(child) === 'a' && child.getAttribute('data-email-button') != null) {
      flush();
      chunks.push(renderNode(child));
    } else {
      inline.push(child);
    }
  }
  flush();
  return chunks.join('');
}

function listHtml(el: HTMLElement, ordered: boolean): string {
  const items = el.childNodes
    .filter((node): node is HTMLElement => isElement(node) && tagOf(node) === 'li')
    .map((li) => {
      const meaningful = li.childNodes.filter((node) => !(node.nodeType === NodeType.TEXT_NODE && !(node as TextNode).text.trim()));
      const alignSource = meaningful.length === 1 && isElement(meaningful[0]) && tagOf(meaningful[0]) === 'p'
        ? meaningful[0]
        : li;
      const inner = renderChildren(unwrapSingleParagraph(li.childNodes)).trim();
      if (!inner) return '';
      return `<li style="margin:0 0 8px;${TEXT}${alignFrom(alignSource)}">${inner}</li>`;
    })
    .filter(Boolean)
    .join('');
  if (!items) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag} style="margin:0 0 16px;padding:0 0 0 24px;${TEXT}">${items}</${tag}>`;
}

function unwrapSingleParagraph(nodes: Node[]): Node[] {
  const elements = nodes.filter((node) => !(node.nodeType === NodeType.TEXT_NODE && !(node as TextNode).text.trim()));
  if (elements.length === 1 && isElement(elements[0]) && tagOf(elements[0]) === 'p') {
    return elements[0].childNodes;
  }
  return nodes;
}

function renderNode(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return escapeText((node as TextNode).text || '');
  }
  if (!isElement(node)) return '';

  const tag = tagOf(node);
  if (DROP_TAGS.has(tag)) return '';

  switch (tag) {
    case 'p':
      return paragraphHtml(node);
    case 'br':
      return '<br />';
    case 'strong':
    case 'b':
      return `<strong style="font-weight:bold;">${renderChildren(node.childNodes)}</strong>`;
    case 'em':
    case 'i':
      return `<em style="font-style:italic;">${renderChildren(node.childNodes)}</em>`;
    case 'u':
      return `<u>${renderChildren(node.childNodes)}</u>`;
    case 'span': {
      if (node.getAttribute('data-recipient-name') != null) {
        return '{Name}';
      }
      const style = spanStyle(node);
      const inner = renderChildren(node.childNodes);
      return style ? `<span style="${style};">${inner}</span>` : inner;
    }
    case 'a': {
      if (node.getAttribute('data-email-button') != null) {
        const href = (node.getAttribute('href') || '').trim();
        if (!isAllowedHref(href)) return '';
        const label = node.text.replace(/\s+/g, ' ').trim();
        return buttonHtml(href, label);
      }
      const href = (node.getAttribute('href') || '').trim();
      if (!isAllowedHref(href)) return renderChildren(node.childNodes);
      return `<a href="${escapeText(href)}" target="_blank" style="color:${COLORS.highlightGold};text-decoration:underline;">${renderChildren(node.childNodes)}</a>`;
    }
    case 'ul':
      return listHtml(node, false);
    case 'ol':
      return listHtml(node, true);
    case 'li':
      return `<p style="margin:0 0 16px;${TEXT}">${renderChildren(unwrapSingleParagraph(node.childNodes))}</p>`;
    case 'img':
      return imageHtml(node);
    case 'hr':
      return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 16px;"><tr><td style="border-top:1px solid ${COLORS.border};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`;
    case 'h1':
    case 'h2':
    case 'h3':
      return `<p style="margin:0 0 16px;${TEXT}font-size:24px;font-weight:bold;${alignFrom(node)}">${renderChildren(node.childNodes)}</p>`;
    case 'div':
    case 'html':
    case 'body':
      return renderChildren(node.childNodes);
    default:
      return renderChildren(node.childNodes);
  }
}

/** Keep only the editor's tags and rewrite them as inline, email-safe HTML. */
export function sanitizePromotionalHtml(html: string): string {
  const root = parse(html || '', { comment: false });
  return renderChildren(root.childNodes).trim();
}
