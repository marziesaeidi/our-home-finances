// Match one complete emoji, including flags, skin tones and joined families.
// HTML maxLength counts UTF-16 units and would split these visible symbols.
const emoji = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)$/u;

export function isSingleEmoji(value: string): boolean {
  return emoji.test(value);
}

export function parseCategoryIdentity(value: string): { name: string; icon: string; error: string } {
  const pattern = new RegExp(`${emoji.source.slice(1, -1)}|◌`, 'gu');
  const icons = value.match(pattern) ?? [];
  const name = value.replace(pattern, '').trim();
  return {
    name,
    icon: icons[0] ?? '◌',
    error: icons.length > 1 ? 'برای دسته‌بندی فقط یک آیکن انتخاب کن.'
      : name.length > 80 ? 'نام دسته‌بندی باید حداکثر ۸۰ نویسه باشد.' : '',
  };
}
