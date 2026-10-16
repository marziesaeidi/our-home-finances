import { createContext, useContext, useEffect, useRef } from 'react';

export type FlowBackAction = { label: string; title?: string; run: () => void };
export const FlowNavigationContext = createContext<(action: FlowBackAction) => (() => void)>(() => () => {});

/** Register a nested flow's back action in the app's top navigation. */
export function FlowBack({ label, title, onBack }: { label: string; title?: string; onBack: () => void }) {
  const register = useContext(FlowNavigationContext);
  const callback = useRef(onBack);
  callback.current = onBack;
  useEffect(() => {
    return register({ label, title, run: () => callback.current() });
  }, [register, label, title]);
  return null;
}
