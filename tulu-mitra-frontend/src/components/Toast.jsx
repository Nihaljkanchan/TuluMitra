import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const notify = useCallback((text, tone = "error") => {
    const id = Math.random().toString(36).slice(2);
    setItems((v) => [...v, { id, text, tone }]);
    setTimeout(() => setItems((v) => v.filter((t) => t.id !== id)), 5000);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.tone === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
