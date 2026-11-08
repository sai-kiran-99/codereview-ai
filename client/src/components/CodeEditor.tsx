import { useRef } from "react";

/** Plain textarea with a line-number gutter (v1). Tab inserts two spaces instead of leaving the field. */
export function CodeEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = Math.max(value.split("\n").length, 1);

  return (
    <div className="flex h-full min-h-[320px] overflow-hidden rounded-xl border border-slate-300 bg-slate-950 font-mono text-[13px] leading-6 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/40">
      <div ref={gutterRef} aria-hidden="true" className="select-none overflow-hidden bg-slate-900 px-3 py-3 text-right text-slate-500">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        aria-label="Code to review"
        value={value}
        disabled={disabled}
        spellCheck={false}
        wrap="off"
        placeholder="Paste your code here…"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          e.preventDefault();
          const el = e.currentTarget;
          const { selectionStart: s, selectionEnd: end } = el;
          onChange(value.slice(0, s) + "  " + value.slice(end));
          requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
        }}
        className="flex-1 resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-60"
      />
    </div>
  );
}
