"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";

export type MenuSelectOption = {
  value: string;
  label: string;
  selectedLabel?: string;
};

export type MenuSelectSection = {
  label?: string;
  options: MenuSelectOption[];
};

export default function MenuSelect({
  value,
  sections,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
  loading = false,
  hint
}: {
  value: string;
  sections: MenuSelectSection[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = sections.flatMap((section) => section.options).find((option) => option.value === value);
  const selectedText = selected?.selectedLabel || selected?.label || value;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideTouch(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideTouch);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideTouch);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function choose(nextValue: string) {
    setOpen(false);
    onChange(nextValue);
  }

  return <div className={`custom-select ${className} ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${hint ? "has-hint" : ""}`} ref={rootRef}>
    <button
      type="button"
      className="custom-select-trigger"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
    >
      {hint ? <><span>{selectedText}</span><small>{hint}</small></> : selectedText}
    </button>
    {loading
      ? <LoaderCircle className="custom-select-spinner" size={14} />
      : <ChevronDown className="custom-select-chevron" size={15} />}
    {open && <div className="custom-select-menu" role="listbox" aria-label={ariaLabel}>
      {sections.map((section, sectionIndex) => <div className="custom-select-section" key={section.label || sectionIndex}>
        {section.label && <span className="custom-select-group-label">{section.label}</span>}
        {section.options.map((option) => <button
          type="button"
          className={`custom-select-option ${value === option.value ? "selected" : ""}`}
          role="option"
          aria-selected={value === option.value}
          key={option.value}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </button>)}
      </div>)}
    </div>}
  </div>;
}
