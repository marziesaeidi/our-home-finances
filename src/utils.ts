export const fa = (n: number) => Math.round(n).toLocaleString('fa-IR');
export const money = (n: number) => `${fa(n)} تومان`;
export const compact = (n: number) => n >= 1_000_000 ? `${fa(n / 1_000_000)} میلیون` : n >= 1_000 ? `${fa(n / 1_000)} هزار` : fa(n);
export const today = () => new Date().toISOString().slice(0, 10);
export const id = () => Math.random().toString(36).slice(2, 10);
export const persianDate = (value: string) => new Date(value).toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' });
export const monthKey = (value: string) => new Date(value).toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit' });
