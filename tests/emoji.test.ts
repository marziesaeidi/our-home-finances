import test from 'node:test';
import assert from 'node:assert/strict';
import { isSingleEmoji, parseCategoryIdentity } from '../src/emoji';

test('custom icon accepts one complete emoji, including multi-codepoint symbols', () => {
  for (const symbol of ['🦋', '✈️', '👍🏽', '👩‍💻', '👨‍👩‍👧‍👦', '🇮🇷', '1️⃣', '🏳️‍🌈', '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}']) {
    assert.equal(isSingleEmoji(symbol), true, symbol);
  }
});

test('custom icon rejects text, numbers, spaces and more than one emoji', () => {
  for (const text of ['', 'الف', 'a', '1', '۱', 'متن دلخواه', '🦋🦋', '🦋 متن', 'a🦋', ' 🦋', '🦋 ', '🇮', '🏽', '🦋\u0301']) {
    assert.equal(isSingleEmoji(text), false, text);
  }
});

test('combined category field separates one complete emoji from the name', () => {
  for (const icon of ['🛒', '👨‍👩‍👧‍👦', '🇮🇷', '👍🏽', '1️⃣', '◌']) {
    assert.deepEqual(parseCategoryIdentity(`${icon} خرید روزانه`), { name: 'خرید روزانه', icon, error: '' });
    assert.deepEqual(parseCategoryIdentity(`خرید روزانه ${icon}`), { name: 'خرید روزانه', icon, error: '' });
  }
  assert.deepEqual(parseCategoryIdentity('خرید ۱۴۰۵'), { name: 'خرید ۱۴۰۵', icon: '◌', error: '' });
  assert.deepEqual(parseCategoryIdentity(''), { name: '', icon: '◌', error: '' });
  assert.deepEqual(parseCategoryIdentity('🛒'), { name: '', icon: '🛒', error: '' });
  assert.ok(parseCategoryIdentity('🛒🦋 خرید').error);
  assert.ok(parseCategoryIdentity(`🛒 ${'ن'.repeat(81)}`).error);
  assert.equal(parseCategoryIdentity(`🛒 ${'ن'.repeat(80)}`).error, '');
});
