import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { EditorContent, Node, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  MousePointerClick,
  User,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const FONTS = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier', value: "'Courier New', Courier, monospace" },
] as const;

const SIZES = [
  { label: 'Small', value: '14px' },
  { label: 'Normal', value: '' },
  { label: 'Large', value: '20px' },
  { label: 'Title', value: '28px' },
] as const;

const COLORS = [
  { label: 'White', value: '#F5F5F5' },
  { label: 'Gold', value: '#FFD700' },
  { label: 'Muted', value: '#B0B0B0' },
  { label: 'Cyan', value: '#00E5FF' },
] as const;

const RecipientName = Node.create({
  name: 'recipientName',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'span[data-recipient-name]' }];
  },
  renderHTML() {
    return ['span', { 'data-recipient-name': '1' }, '{Name}'];
  },
});

const EmailButton = Node.create({
  name: 'emailButton',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      href: { default: '' },
      label: {
        default: 'Open',
        parseHTML: (element: HTMLElement) => element.textContent?.trim() || 'Open',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-email-button]' }];
  },
  renderHTML({ node }) {
    return [
      'a',
      {
        'data-email-button': '1',
        href: node.attrs.href,
      },
      node.attrs.label,
    ];
  },
});

export function emailHtmlHasContent(html: string): boolean {
  if (!html) return false;
  if (/<img\b/i.test(html)) return true;
  if (/data-email-button/i.test(html)) return true;
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .trim();
  return text.length > 0;
}

function normalizeFontKey(value: string): string {
  return value.toLowerCase().replace(/["']/g, '').replace(/\s+/g, ' ').trim();
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (/^mailto:[^<>\s"]+$/i.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

type Panel = 'link' | 'button' | 'image' | null;

interface EmailComposerProps {
  value: string;
  onChange: (html: string) => void;
  uploadImage: (file: File) => Promise<string>;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-2 transition disabled:opacity-40 ${
        active ? 'bg-[#FFD700] text-[#0A0A0F]' : 'text-[#F5F5F5] hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export function EmailComposer({ value, onChange, uploadImage }: EmailComposerProps) {
  const onChangeRef = useRef(onChange);
  const uploadRef = useRef(uploadImage);
  const lastHtml = useRef(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [buttonLabel, setButtonLabel] = useState('');
  const [buttonUrl, setButtonUrl] = useState('https://');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState('');
  const [uploading, setUploading] = useState(false);

  onChangeRef.current = onChange;
  uploadRef.current = uploadImage;

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['http', 'https', 'mailto'],
        },
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      TextAlign.configure({
        types: ['paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
      Image.configure({ allowBase64: false }),
      RecipientName,
      EmailButton,
      Placeholder.configure({
        placeholder: 'Write the email...',
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'email-composer-body',
        'aria-label': 'Email content',
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      lastHtml.current = html;
      onChangeRef.current(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === lastHtml.current) return;
    lastHtml.current = value;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) {
        return {
          bold: false,
          italic: false,
          underline: false,
          bullet: false,
          ordered: false,
          link: false,
          align: '',
          fontFamily: '',
          fontSize: '',
          color: '',
          canUndo: false,
          canRedo: false,
        };
      }
      const textStyle = current.getAttributes('textStyle');
      let align = '';
      if (current.isActive({ textAlign: 'left' })) align = 'left';
      if (current.isActive({ textAlign: 'center' })) align = 'center';
      if (current.isActive({ textAlign: 'right' })) align = 'right';
      return {
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        underline: current.isActive('underline'),
        bullet: current.isActive('bulletList'),
        ordered: current.isActive('orderedList'),
        link: current.isActive('link'),
        align,
        fontFamily: typeof textStyle.fontFamily === 'string' ? textStyle.fontFamily : '',
        fontSize: typeof textStyle.fontSize === 'string' ? textStyle.fontSize : '',
        color: typeof textStyle.color === 'string' ? textStyle.color.toLowerCase() : '',
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });

  const run = (command: (current: Editor) => void) => {
    if (!editor) return;
    command(editor);
  };

  const openLink = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to && !editor.isActive('link')) {
      toast.error('Select the words you want to link');
      return;
    }
    const current = editor.getAttributes('link').href;
    setLinkUrl(typeof current === 'string' && current ? current : 'https://');
    setPanel('link');
  };

  const applyLink = () => {
    const href = linkUrl.trim();
    if (!isSafeHref(href)) {
      toast.error('Use a full http, https, or mailto link');
      return;
    }
    run((current) => {
      current.chain().focus().extendMarkRange('link').setLink({ href }).run();
    });
    setPanel(null);
  };

  const applyButton = () => {
    const label = buttonLabel.trim();
    const href = buttonUrl.trim();
    if (!label) {
      toast.error('Add the button text');
      return;
    }
    if (!isSafeHref(href)) {
      toast.error('Use a full http or https link for the button');
      return;
    }
    run((current) => {
      current.chain().focus().insertContent({
        type: 'emailButton',
        attrs: { href, label },
      }).run();
    });
    setButtonLabel('');
    setButtonUrl('https://');
    setPanel(null);
  };

  const applyImage = async () => {
    if (!imageFile || !editor) return;
    setUploading(true);
    try {
      const url = await uploadRef.current(imageFile);
      editor.chain().focus().setImage({ src: url, alt: imageAlt.trim() || 'Image' }).run();
      setImageFile(null);
      setImageAlt('');
      setPanel(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not add that image';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const fontValue = FONTS.find((font) => normalizeFontKey(font.value) === normalizeFontKey(toolbar?.fontFamily || ''))?.value || '';
  const sizeValue = SIZES.some((size) => size.value === (toolbar?.fontSize || '')) ? (toolbar?.fontSize || '') : '';

  const fieldClass = 'min-h-11 w-full rounded-lg border border-white/15 bg-[#0A0A0F] px-3 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFD700]';

  return (
    <div className="email-composer overflow-hidden rounded-xl border border-[#2C2C3A] bg-[#14141F]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#2C2C3A] p-2">
        <ToolButton label="Bold" active={toolbar?.bold} onClick={() => run((current) => current.chain().focus().toggleBold().run())}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Italic" active={toolbar?.italic} onClick={() => run((current) => current.chain().focus().toggleItalic().run())}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Underline" active={toolbar?.underline} onClick={() => run((current) => current.chain().focus().toggleUnderline().run())}>
          <Underline className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
        <label className="sr-only" htmlFor="email-font">Font</label>
        <select
          id="email-font"
          aria-label="Font"
          value={fontValue}
          onChange={(event) => {
            const next = event.target.value;
            run((current) => {
              const chain = current.chain().focus();
              if (!next) chain.unsetFontFamily().run();
              else chain.setFontFamily(next).run();
            });
          }}
          className="h-11 max-w-[8.5rem] rounded-lg border border-white/15 bg-[#1B1B2F] px-2 text-base text-white"
        >
          <option value="">Font</option>
          {FONTS.map((font) => (
            <option key={font.label} value={font.value}>{font.label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="email-size">Size</label>
        <select
          id="email-size"
          aria-label="Text size"
          value={sizeValue}
          onChange={(event) => {
            const next = event.target.value;
            run((current) => {
              const chain = current.chain().focus();
              if (!next) chain.unsetFontSize().run();
              else chain.setFontSize(next).run();
            });
          }}
          className="h-11 max-w-[7.5rem] rounded-lg border border-white/15 bg-[#1B1B2F] px-2 text-base text-white"
        >
          {SIZES.map((size) => (
            <option key={size.label} value={size.value}>{size.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1" role="group" aria-label="Text color">
          {COLORS.map((color) => {
            const active = toolbar?.color === color.value.toLowerCase();
            return (
              <button
                key={color.value}
                type="button"
                aria-label={color.label}
                title={color.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run((current) => {
                  const chain = current.chain().focus();
                  if (active) chain.unsetColor().run();
                  else chain.setColor(color.value).run();
                })}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${active ? 'bg-white/10 ring-2 ring-[#FFD700]' : 'hover:bg-white/10'}`}
              >
                <span className="h-4 w-4 rounded-full border border-white/30" style={{ backgroundColor: color.value }} />
              </button>
            );
          })}
        </div>
        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
        <ToolButton label="Align left" active={toolbar?.align === 'left'} onClick={() => run((current) => current.chain().focus().setTextAlign('left').run())}>
          <AlignLeft className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Align center" active={toolbar?.align === 'center'} onClick={() => run((current) => current.chain().focus().setTextAlign('center').run())}>
          <AlignCenter className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Align right" active={toolbar?.align === 'right'} onClick={() => run((current) => current.chain().focus().setTextAlign('right').run())}>
          <AlignRight className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Bulleted list" active={toolbar?.bullet} onClick={() => run((current) => current.chain().focus().toggleBulletList().run())}>
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Numbered list" active={toolbar?.ordered} onClick={() => run((current) => current.chain().focus().toggleOrderedList().run())}>
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Divider" onClick={() => run((current) => current.chain().focus().setHorizontalRule().run())}>
          <Minus className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Insert name" onClick={() => run((current) => current.chain().focus().insertContent({ type: 'recipientName' }).run())}>
          <User className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Link" active={toolbar?.link || panel === 'link'} onClick={openLink}>
          <Link2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Button" active={panel === 'button'} onClick={() => setPanel(panel === 'button' ? null : 'button')}>
          <MousePointerClick className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Image" active={panel === 'image'} onClick={() => setPanel(panel === 'image' ? null : 'image')}>
          <ImagePlus className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
        <ToolButton label="Clear formatting" onClick={() => run((current) => current.chain().focus().unsetAllMarks().clearNodes().run())}>
          <RemoveFormatting className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Undo" disabled={!toolbar?.canUndo} onClick={() => run((current) => current.chain().focus().undo().run())}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo" disabled={!toolbar?.canRedo} onClick={() => run((current) => current.chain().focus().redo().run())}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
      </div>

      {panel === 'link' && (
        <div className="flex flex-col gap-2 border-b border-[#2C2C3A] p-3 sm:flex-row sm:items-center">
          <input
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://"
            aria-label="Link address"
            className={fieldClass}
          />
          <div className="flex gap-2">
            <button type="button" onClick={applyLink} className="min-h-11 flex-1 rounded-lg bg-[#FFD700] px-4 text-sm font-semibold text-[#0A0A0F] sm:flex-none">
              Apply link
            </button>
            {toolbar?.link && (
              <button
                type="button"
                onClick={() => {
                  run((current) => current.chain().focus().unsetLink().run());
                  setPanel(null);
                }}
                className="min-h-11 rounded-lg px-4 text-sm text-white/80 hover:bg-white/10"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {panel === 'button' && (
        <div className="grid gap-2 border-b border-[#2C2C3A] p-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <input
            type="text"
            value={buttonLabel}
            onChange={(event) => setButtonLabel(event.target.value)}
            placeholder="Button text"
            aria-label="Button text"
            className={fieldClass}
          />
          <input
            type="url"
            value={buttonUrl}
            onChange={(event) => setButtonUrl(event.target.value)}
            placeholder="https://"
            aria-label="Button link"
            className={fieldClass}
          />
          <button type="button" onClick={applyButton} className="min-h-11 rounded-lg bg-[#FFD700] px-4 text-sm font-semibold text-[#0A0A0F]">
            Add button
          </button>
        </div>
      )}

      {panel === 'image' && (
        <div className="grid gap-2 border-b border-[#2C2C3A] p-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            aria-label="Choose an image"
            onChange={(event) => setImageFile(event.target.files?.[0] || null)}
            className="min-h-11 w-full text-base text-white file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:text-sm file:text-white"
          />
          <input
            type="text"
            value={imageAlt}
            onChange={(event) => setImageAlt(event.target.value)}
            placeholder="Describe the image"
            aria-label="Image description"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={applyImage}
            disabled={!imageFile || uploading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#FFD700] px-4 text-sm font-semibold text-[#0A0A0F] disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add image
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
      <style>{`
        .email-composer .ProseMirror {
          min-height: 220px;
          padding: 16px;
          outline: none;
          color: #F5F5F5;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 16px;
          line-height: 1.7;
        }
        .email-composer .ProseMirror p { margin: 0 0 12px; }
        .email-composer .ProseMirror ul,
        .email-composer .ProseMirror ol { margin: 0 0 12px; padding-left: 1.25rem; }
        .email-composer .ProseMirror span[data-recipient-name] {
          display: inline-block;
          margin: 0 1px;
          padding: 0 7px;
          border-radius: 999px;
          background: rgba(255, 215, 0, 0.16);
          color: #FFD700;
          font-weight: 700;
        }
        .email-composer .ProseMirror a { color: #FFD700; }
        .email-composer .ProseMirror a[data-email-button] {
          display: table;
          margin: 12px auto;
          padding: 12px 28px;
          border-radius: 8px;
          background: #FFD700;
          color: #0A0A0F;
          font-weight: 700;
          text-decoration: none;
        }
        .email-composer .ProseMirror img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 12px auto;
          border-radius: 8px;
        }
        .email-composer .ProseMirror hr {
          margin: 16px 0;
          border: 0;
          border-top: 1px solid #2C2C3A;
        }
        .email-composer .ProseMirror p.is-editor-empty:first-child::before {
          float: left;
          height: 0;
          color: #8a8a9a;
          pointer-events: none;
          content: attr(data-placeholder);
        }
      `}</style>
    </div>
  );
}
