"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`select-chevron ${open ? "open" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SelectMenu({
  id,
  value,
  options,
  onChange,
  placeholder = "Select",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`select-menu ${className}`.trim()}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="select-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="select-value">
          {selected ? selected.label : <span className="select-placeholder">{placeholder}</span>}
        </span>
        <ChevronDown open={open} />
      </button>

      {open ? (
        <div role="listbox" className="select-dropdown">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className={`select-option ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <svg className="select-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
