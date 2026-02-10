import React from 'react';

export interface LabelData {
  _id: string;
  name: string;
  color: string;
}

interface LabelBadgeProps {
  label: LabelData;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

const LabelBadge: React.FC<LabelBadgeProps> = ({ label, size = 'sm', onRemove }) => {
  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-xs px-2 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses} transition-colors`}
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
        border: `1px solid ${label.color}40`,
      }}
    >
      <span
        className={`rounded-full flex-shrink-0 ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
        style={{ backgroundColor: label.color }}
      />
      {label.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:opacity-70 transition-opacity font-bold leading-none"
          style={{ color: label.color }}
        >
          &times;
        </button>
      )}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LabelSelector: dropdown to assign labels to a user
// ─────────────────────────────────────────────────────────────────────────────
interface LabelSelectorProps {
  allLabels: LabelData[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

export const LabelSelector: React.FC<LabelSelectorProps> = ({
  allLabels,
  selectedIds,
  onChange,
  loading,
}) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
        Labels
        {selectedIds.length > 0 && (
          <span className="bg-blue-500/30 text-blue-300 rounded-full px-1.5 text-[10px] font-bold">
            {selectedIds.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 w-52 rounded-lg border border-white/10 bg-[#1a1a2e] shadow-xl overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-white/10">
            <span className="text-xs text-gray-400 font-medium">Assign Labels</span>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {allLabels.length === 0 ? (
              <p className="text-xs text-gray-500 p-2 text-center">No labels created</p>
            ) : (
              allLabels.map(label => (
                <label
                  key={label._id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(label._id)}
                    onChange={() => toggle(label._id)}
                    className="rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/30 w-3.5 h-3.5"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="text-xs text-gray-200 truncate">{label.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LabelFilter: multi-select filter bar above user/conversation lists
// ─────────────────────────────────────────────────────────────────────────────
interface LabelFilterProps {
  allLabels: LabelData[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export const LabelFilter: React.FC<LabelFilterProps> = ({ allLabels, selectedIds, onChange }) => {
  if (allLabels.length === 0) return null;

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {selectedIds.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-1"
        >
          Clear
        </button>
      )}
      {allLabels.map(label => {
        const active = selectedIds.includes(label._id);
        return (
          <button
            key={label._id}
            onClick={() => toggle(label._id)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
              active
                ? 'border-current shadow-sm'
                : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{
              backgroundColor: active ? `${label.color}25` : `${label.color}10`,
              color: label.color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: label.color }}
            />
            {label.name}
          </button>
        );
      })}
    </div>
  );
};

export default LabelBadge;
