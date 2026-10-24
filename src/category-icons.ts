import type { Category } from './types';

export const incomeIcons: Record<string, string> = {
  'حقوق': '💼', 'پاداش': '🏅', 'هدیه': '🎁', 'فروش رمز ارز': '🪙', 'سایر': '💰',
};

const expenseIcons: Record<string, string> = {
  'خوراک': '🛒', 'خرید': '🛍️', 'خانه': '🏠', 'حمل‌ونقل': '🚕',
  'سلامت': '💊', 'تفریح': '☕', 'قبوض': '🧾', 'سفر': '✈️',
  'اقساط': '💳', 'درآمد': '↙️', 'سایر': '◌',
};

export const iconFor = (name: string): string => expenseIcons[name] || '◌';

/** Legacy categories omit icons; use the same defaults as the transaction form. */
export function categoryIcon(category: Pick<Category, 'name' | 'icon'>): string {
  return category.icon || incomeIcons[category.name] || iconFor(category.name);
}
