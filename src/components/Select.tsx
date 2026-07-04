"use client";

import { useState, useRef, useEffect, Children, isValidElement, useCallback } from "react";
import { createPortal } from "react-dom";

interface SelectProps {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
}

const DROPDOWN_MARGIN = 4;

export default function Select({ value, onChange, children, className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const updatePosition = useCallback(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const estimatedHeight = 200;
    const fitsBelow = rect.bottom + DROPDOWN_MARGIN + estimatedHeight <= vh;
    setPos({
      top: fitsBelow ? rect.bottom + DROPDOWN_MARGIN : rect.top - DROPDOWN_MARGIN,
      left: rect.left,
      width: rect.width,
      openUp: !fitsBelow,
    });
  }, [open]);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!open) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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
    <div ref={triggerRef} className={`relative ${className}`}>
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

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 9999,
            opacity: 1,
            transform: "translateY(0)",
            background: "rgba(21,21,30,0.96)",
            backdropFilter: "blur(20px)",
            borderColor: "var(--glass-border)",
            borderRadius: "0.5rem",
            border: "1px solid var(--glass-border)",
            overflow: "hidden",
          }}
          className="transition-all duration-200"
        >
          {options.map((opt, i) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={String(opt.value) === String(value)}
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
                animationName: "slide-up",
                animationDuration: "0.2s",
                animationTimingFunction: "ease-out",
                animationFillMode: "both",
                animationDelay: `${i * 25}ms`,
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
        </div>,
        document.body
      )}
    </div>
  );
}
