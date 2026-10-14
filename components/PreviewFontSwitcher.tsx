"use client";

import { useEffect, useState } from "react";

type FontKey = "barlow" | "manrope" | "outfit" | "dm-sans" | "jakarta" | "archivo" | "rubik" | "space-grotesk" | "original";

const choices: { value: FontKey; label: string }[] = [
  { value: "barlow", label: "Barlow" },
  { value: "manrope", label: "Manrope" },
  { value: "outfit", label: "Outfit" },
  { value: "dm-sans", label: "DM Sans" },
  { value: "jakarta", label: "Plus Jakarta Sans" },
  { value: "archivo", label: "Archivo" },
  { value: "rubik", label: "Rubik" },
  { value: "space-grotesk", label: "Space Grotesk" },
  { value: "original", label: "Roboto Slab (original)" }
];

const valid = new Set<string>(choices.map(choice => choice.value));

export default function PreviewFontSwitcher() {
  const [selected, setSelected] = useState<FontKey>("barlow");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("pickem-preview-font");
      const value = stored && valid.has(stored) ? stored as FontKey : "barlow";
      setSelected(value);
      document.documentElement.setAttribute("data-preview-font", value);
    } catch {
      document.documentElement.setAttribute("data-preview-font", "barlow");
    }
  }, []);
  function choose(value: FontKey) {
    setSelected(value);
    document.documentElement.setAttribute("data-preview-font", value);
    try { window.localStorage.setItem("pickem-preview-font", value); } catch { /* private mode */ }
  }
  return <label className="preview-font-picker">
    <span>FONT TEST</span>
    <select aria-label="Preview different fonts" value={selected} onChange={event => choose(event.target.value as FontKey)}>
      {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
    </select>
  </label>;
}
