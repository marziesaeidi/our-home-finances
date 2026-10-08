import type { Category, FinanceData } from './types';

export function categoryNames(data: FinanceData, kind?: 'income' | 'expense') {
  return data.categoryRecords.filter(c => !c.archived && (!kind || !c.kind || c.kind === 'both' || c.kind === kind)).map(c => c.name);
}

export function saveCategory(data: FinanceData, category: Category): FinanceData {
  const name = category.name.trim();
  if (!name || name.length > 80 || data.categoryRecords.some(c => c.id !== category.id && c.name === name)) throw new Error('نام دسته لازم است و نباید تکراری باشد.');
  if (category.icon && Array.from(category.icon).length > 16 || category.color && !/^#[0-9a-fA-F]{6}$/.test(category.color)) throw new Error('آیکن یا رنگ معتبر نیست.');
  const previous = data.categoryRecords.find(c => c.id === category.id);
  const renameBudget = (budget: FinanceData['budget']) => {
    if (!previous || previous.name === name || budget.categories[previous.name] === undefined) return budget;
    const categories = { ...budget.categories, [name]: budget.categories[previous.name] };
    delete categories[previous.name];
    return { ...budget, categories };
  };
  return { ...data,
    categoryRecords: previous ? data.categoryRecords.map(c => c.id === category.id ? { ...category, name } : c) : [...data.categoryRecords, { ...category, name }],
    transactions: data.transactions.map(t => t.categoryId === category.id || previous && !t.categoryId && t.category === previous.name ? { ...t, category: name, categoryId: category.id } : t),
    recurring: data.recurring.map(r => previous && r.category === previous.name ? { ...r, category: name } : r),
    obligations: data.obligations.map(o => previous && o.category === previous.name ? { ...o, category: name } : o),
    budget: renameBudget(data.budget), monthlyBudgets: Object.fromEntries(Object.entries(data.monthlyBudgets).map(([key, budget]) => [key, renameBudget(budget)])),
  };
}
