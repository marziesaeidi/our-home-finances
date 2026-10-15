import { createContext, useContext, useEffect, useRef } from 'react';

export type FlowBackAction = { label: string; run: () => void };
export const FlowNavigationContext = createContext<(action: FlowBackAction | null) => void>(() => {});

/** Register a nested flow's back action in the app's top navigation. */
export function FlowBack({ label, onBack }: { label: string; onBack: () => void }) {
  const register = useContext(FlowNavigationContext);
  const callback = useRef(onBack);
  callback.current = onBack;
  useEffect(() => {
    register({ label, run: () => callback.current() });
    return () => register(null);
  }, [register, label]);
  return null;
}
