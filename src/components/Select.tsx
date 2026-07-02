"use client";

import { useState, useRef, useEffect, Children, isValidElement } from "react";

interface SelectProps {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
}

export default function Select({ value, onChange, children, className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = Children.toArray(children)
    .filter((child): child is React.ReactElement<{
      value: string;
      disabled?: boolean;
      children: React.ReactNode;
    }> => isValidElement(child) && child.type === "option")
    .map((child) => ({
      value: child.props.value,
      label: child.props.children,
      disabled: child.props.disabled,
    }));

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left cursor-pointer border transition-all duration-150"
        style={{
          background: "rgba(255,255,255,0.04)",
          color: "var(--text-primary)",
          borderColor: open ? "var(--accent)" : "var(--border)",
          boxShadow: open ? "0 0 0 3px rgba(233, 177, 163, 0.15)" : "none",
          backdropFilter: "blur(4px)",
          fontFamily: "'Onest', system-ui, -apple-system, sans-serif",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.borderColor = "var(--text-secondary)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        <span className="truncate">{selected?.label ?? "Выберите..."}</span>
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div
        className="absolute left-0 right-0 z-50 mt-1 rounded-lg border overflow-hidden transition-all duration-200"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: open ? "auto" : "none",
          background: "rgba(21,21,30,0.96)",
          backdropFilter: "blur(20px)",
          borderColor: "var(--glass-border)",
        }}
      >
        {options.map((opt, i) => (
          <div
            key={opt.value}
            onClick={() => {
              if (!opt.disabled) {
                onChange({ target: { value: opt.value } });
                setOpen(false);
              }
            }}
            className="px-3 py-2 text-sm cursor-pointer transition-colors"
            style={{
              color: String(opt.value) === String(value) ? "var(--accent)" : "var(--text-primary)",
              background: String(opt.value) === String(value) ? "rgba(233, 177, 163, 0.1)" : "transparent",
              opacity: opt.disabled ? 0.4 : 1,
              fontFamily: "'Onest', system-ui, -apple-system, sans-serif",
              animation: open ? `slide-up 0.2s ease-out both` : "none",
              animationDelay: open ? `${i * 25}ms` : "0ms",
            }}
            onMouseEnter={(e) => { if (!opt.disabled) e.currentTarget.style.background = "rgba(233, 177, 163, 0.08)"; }}
            onMouseLeave={(e) => {
              if (!opt.disabled) {
                e.currentTarget.style.background =
                  String(opt.value) === String(value) ? "rgba(233, 177, 163, 0.1)" : "transparent";
              }
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}
