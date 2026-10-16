export const iconOptions = [
  ['🛒','خوراک'], ['🛍️','خرید'], ['🏠','خانه'], ['🚗','خودرو'], ['🚕','تاکسی'], ['💊','سلامت'],
  ['☕','تفریح'], ['🧾','قبوض'], ['✈️','سفر'], ['💳','اقساط'], ['💰','پول'],
  ['💼','کار'], ['🏅','پاداش'], ['🪙','رمزارز'], ['🌱','پس‌انداز'], ['🎓','آموزش'],
  ['🎁','هدیه'], ['🛟','اضطراری'], ['💅','مراقبت شخصی'], ['📁','پوشه'], ['🎉','مناسبت'], ['🔧','تعمیرات'], ['◌','سایر'],
] as const;
export const iconLabel = (symbol: string) => iconOptions.find(([value]) => value === symbol)?.[1] ?? 'سایر';
export function AppIcon({ symbol, size = 20 }: { symbol?: string; size?: number }) {
  return <span className="app-symbol" style={{ fontSize: size }} aria-hidden="true">{symbol || '◌'}</span>;
}
