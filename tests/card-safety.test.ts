import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBankCardList } from '../src/banking/bankingTypes.ts';

test('card normalization removes sensitive fields and preserves a masked reference', () => {
  const cards = normalizeBankCardList([{
    id: 'demo', label: 'Demo', network: 'Mastercard', number: '4111111111111111',
    last4: '1111', cvv: '123', expiry: '01/30', linkedAccountId: 'account',
    locked: false, contactless: true, international: true, onlinePurchases: true, accent: 'business',
  }]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].last4, '1111');
  assert.equal('number' in cards[0], false);
  assert.equal('cvv' in cards[0], false);
});

test('invalid card lists and duplicate ids are handled', () => {
  assert.deepEqual(normalizeBankCardList(null), []);
  const card = { id: 'one', label: 'Demo', network: 'Debit' as const, last4: '12345678', expiry: '', linkedAccountId: '', locked: false, contactless: false, international: false, onlinePurchases: false, accent: 'debit' as const };
  assert.deepEqual(normalizeBankCardList([card, card]).map(c => c.last4), ['5678']);
});
