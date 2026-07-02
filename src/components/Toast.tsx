"use client";

import { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

function ToastItem({ t, onDone }: { t: Toast; onDone: (id: number) => void }) {
  return (
    <div
      className={`toast toast-${t.type}`}
      onClick={() => onDone(t.id)}
    >
      <span>{t.message}</span>
      <button className="toast-close" onClick={(e) => { e.stopPropagation(); onDone(t.id); }}>×</button>
    </div>
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3500);
  }, [removeToast]);

  const value: ToastContextValue = {
    toast: addToast,
    success: useCallback((msg: string) => addToast(msg, "success"), [addToast]),
    error: useCallback((msg: string) => addToast(msg, "error"), [addToast]),
    info: useCallback((msg: string) => addToast(msg, "info"), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onDone={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
