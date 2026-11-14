/**
 * Quote Math Tests
 *
 * Verifies the shared quote totals used by the wizard, detail modal, PDF and DB insert.
 * Run with: npm test or vitest
 */

import { describe, it, expect } from 'vitest';
import {
  calculateQuoteTotals,
  calculateTotalsFromSubtotal,
  calculateDepositAmount,
  quoteDepositPercent,
  DEFAULT_DEPOSIT_RATE,
  formatQuoteMoney,
  roundCents,
} from '../quoteMath';

describe('quoteMath', () => {
  describe('roundCents', () => {
    it('rounds .005 cases half-up despite binary representation', () => {
      expect(roundCents(1.005)).toBe(1.01);
      expect(roundCents(2.675)).toBe(2.68);
      expect(roundCents(10000.005)).toBe(10000.01);
      expect(roundCents(0.125)).toBe(0.13);
      expect(roundCents(1.004)).toBe(1);
    });

    it('rounds negatives away from zero and handles non-finite input', () => {
      expect(roundCents(-1.005)).toBe(-1.01);
      expect(roundCents(NaN)).toBe(0);
      expect(roundCents(Infinity)).toBe(0);
      expect(Object.is(roundCents(-0.001), 0)).toBe(true);
    });
  });

  describe('calculateQuoteTotals', () => {
    it('computes a standard Italian quote with 22% VAT', () => {
      const t = calculateQuoteTotals({
        lineItems: [
          { amount: 2500, quantity: 1 },
          { amount: 150 },
          { amount: 400, quantity: 1 },
          { amount: 300, quantity: 1 },
          { amount: 200, quantity: 1 },
        ],
        discountType: 'percentage',
        discountValue: 10,
        vatRate: 22,
      });
      expect(t).toEqual({ subtotal: 3550, discount: 355, net: 3195, vat: 702.9, total: 3897.9 });
    });

    it('applies no VAT when the rate is 0', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 1000 }],
        discountType: 'none',
        discountValue: 0,
        vatRate: 0,
      });
      expect(t).toEqual({ subtotal: 1000, discount: 0, net: 1000, vat: 0, total: 1000 });
    });

    it('applies no VAT when exempt or reverse charge', () => {
      const exempt = calculateQuoteTotals({ lineItems: [{ amount: 1000 }], vatRate: 22, vatExempt: true });
      const reverse = calculateQuoteTotals({ lineItems: [{ amount: 1000 }], vatRate: 22, reverseCharge: true });
      expect(exempt.vat).toBe(0);
      expect(exempt.total).toBe(1000);
      expect(reverse.vat).toBe(0);
    });

    it('treats a negative fixed discount as no discount', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 1000 }],
        discountType: 'fixed',
        discountValue: -200,
        vatRate: 22,
      });
      expect(t).toEqual({ subtotal: 1000, discount: 0, net: 1000, vat: 220, total: 1220 });
    });

    it('treats a negative percentage discount as no discount', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 1000 }],
        discountType: 'percentage',
        discountValue: -10,
        vatRate: 22,
      });
      expect(t.discount).toBe(0);
      expect(t.total).toBe(1220);
    });

    it('clamps a fixed discount larger than the subtotal (never negative totals)', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 500 }],
        discountType: 'fixed',
        discountValue: 800,
        vatRate: 22,
      });
      expect(t).toEqual({ subtotal: 500, discount: 500, net: 0, vat: 0, total: 0 });
    });

    it('clamps a percentage discount above 100%', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 500 }],
        discountType: 'percentage',
        discountValue: 150,
        vatRate: 22,
      });
      expect(t).toEqual({ subtotal: 500, discount: 500, net: 0, vat: 0, total: 0 });
    });

    it('applies a percentage discount (not as a fixed amount)', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 2000 }],
        discountType: 'percentage',
        discountValue: 15,
        vatRate: 22,
      });
      expect(t).toEqual({ subtotal: 2000, discount: 300, net: 1700, vat: 374, total: 2074 });
    });

    it('ignores the discount value when the type is none', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 100 }],
        discountType: 'none',
        discountValue: 50,
        vatRate: 0,
      });
      expect(t.discount).toBe(0);
      expect(t.total).toBe(100);
    });

    it('rounds line totals first, then the totals (.005 cases)', () => {
      // 3 x 0.335 = 1.005 -> line rounds to 1.01 (not 1.00)
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 0.335, quantity: 3 }],
        discountType: 'none',
        vatRate: 0,
      });
      expect(t.subtotal).toBe(1.01);

      // net 10.25 * 22% = 2.255 -> VAT 2.26
      const v = calculateQuoteTotals({ lineItems: [{ amount: 10.25 }], vatRate: 22 });
      expect(v.vat).toBe(2.26);
      expect(v.total).toBe(12.51);

      // 0.5% of 201 = 1.005 -> discount 1.01
      const d = calculateQuoteTotals({
        lineItems: [{ amount: 201 }],
        discountType: 'percentage',
        discountValue: 0.5,
        vatRate: 0,
      });
      expect(d.discount).toBe(1.01);
      expect(d.net).toBe(199.99);
    });

    it('sums rounded line totals rather than raw products', () => {
      // each line 0.005 -> 0.01; three lines -> 0.03 (raw sum 0.015 would round to 0.02)
      const t = calculateQuoteTotals({
        lineItems: [{ amount: 0.005 }, { amount: 0.005 }, { amount: 0.005 }],
        vatRate: 0,
      });
      expect(t.subtotal).toBe(0.03);
    });

    it('treats non-finite values and negative VAT as 0', () => {
      const t = calculateQuoteTotals({
        lineItems: [{ amount: NaN }, { amount: 100, quantity: NaN }, { amount: 50 }],
        discountType: 'fixed',
        discountValue: NaN,
        vatRate: -5,
      });
      expect(t).toEqual({ subtotal: 50, discount: 0, net: 50, vat: 0, total: 50 });
    });

    it('never returns a negative subtotal', () => {
      const t = calculateQuoteTotals({ lineItems: [{ amount: -100 }], vatRate: 22 });
      expect(t).toEqual({ subtotal: 0, discount: 0, net: 0, vat: 0, total: 0 });
    });
  });

  describe('helpers', () => {
    it('calculateTotalsFromSubtotal matches calculateQuoteTotals', () => {
      expect(
        calculateTotalsFromSubtotal(3550, { discountType: 'percentage', discountValue: 10, vatRate: 22 })
      ).toEqual({ subtotal: 3550, discount: 355, net: 3195, vat: 702.9, total: 3897.9 });
    });

    it('calculateDepositAmount rounds to cents and clamps the percentage', () => {
      expect(calculateDepositAmount(3897.9, 30)).toBe(1169.37);
      expect(calculateDepositAmount(1000, 150)).toBe(1000);
      expect(calculateDepositAmount(1000, -10)).toBe(0);
    });

    it('formatQuoteMoney shows cents only when present', () => {
      expect(formatQuoteMoney(1250)).toBe('€1,250');
      expect(formatQuoteMoney(1250.5)).toBe('€1,250.50');
      expect(formatQuoteMoney(702.9, '$')).toBe('$702.90');
    });
  });
});

describe('quoteDepositPercent (detail, PDF and client page agree)', () => {
  it('no deposit or 0% means no deposit, not a 30% fallback', () => {
    expect(quoteDepositPercent({ depositRequired: false, depositPercentage: 30 })).toBe(0);
    expect(quoteDepositPercent({ depositPercentage: 0 })).toBe(0);
    expect(quoteDepositPercent({ depositRequired: true, depositPercentage: 0 }, 30)).toBe(0);
  });

  it('uses the quote, then the band default, then the shared default', () => {
    expect(quoteDepositPercent({ depositPercentage: 25 }, 40)).toBe(25);
    expect(quoteDepositPercent({}, 40)).toBe(40);
    expect(quoteDepositPercent({})).toBe(DEFAULT_DEPOSIT_RATE);
    expect(quoteDepositPercent({ depositPercentage: 140 })).toBe(100);
  });

  it('the deposit amount follows the percentage to the cent', () => {
    expect(calculateDepositAmount(1234.5, quoteDepositPercent({ depositPercentage: 30 }))).toBe(370.35);
    expect(calculateDepositAmount(1234.5, quoteDepositPercent({ depositRequired: false }))).toBe(0);
  });
});
