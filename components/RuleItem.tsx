"use client";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function RuleItem({ title, children }: { title: string; children: ReactNode }) {
  return <details className="rule-item">
    <summary><strong>{title}</strong><ChevronDown className="rule-chevron" size={17} /></summary>
    <div className="rule-copy">{children}</div>
  </details>;
}

