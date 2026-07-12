"use client";

import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

export function TagListEditor({ label, value, onChange, placeholder = "ADD TAG + ENTER" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const tags = parseTags(value);

  const commit = () => {
    const additions = parseTags(draft);
    if (additions.length === 0) { setDraft(""); return; }
    const seen = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
    const next = [...tags];
    for (const addition of additions) {
      const key = addition.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(addition);
    }
    onChange(next.join("\n"));
    setDraft("");
  };

  const remove = (index: number) => {
    onChange(tags.filter((_, tagIndex) => tagIndex !== index).join("\n"));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      remove(tags.length - 1);
    }
  };

  const focusInputFromEmptySpace = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) inputRef.current?.focus();
  };

  return (
    <div className="text-sm">
      <label className="block" htmlFor={inputId}><span className="mb-1 block font-medium">{label}</span></label>
      <div className="settings-token-editor" onClick={focusInputFromEmptySpace}>
        {tags.map((tag, index) => (
          <span className="settings-token" key={`${tag}_${index}`}>
            <span className="settings-token-value">{tag}</span>
            <button aria-label={`Remove ${tag}`} className="settings-token-remove" onClick={() => remove(index)} type="button">{"\u00D7"}</button>
          </span>
        ))}
        <input
          aria-label={`Add ${label}`}
          className="settings-token-input"
          id={inputId}
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : "ADD + ENTER"}
          ref={inputRef}
          value={draft}
        />
      </div>
    </div>
  );
}

function parseTags(value: string): string[] {
  return value.split(/[\n,]+/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
}