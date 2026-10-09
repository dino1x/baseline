import { describe, it, expect } from 'vitest';
import { failedCriteria, satisfiesCriteria } from '../../contract/src/domain/criteria';
import {
  pureCircuits,
  type AcademicRecord,
  type AwardCriteria,
} from '../../contract/src/managed/baseline/contract/index.js';

const base: AcademicRecord = {
  gpa: 385n, programId: 101n, enrolled: true,
  financialNeed: 4500n, completedCredits: 74n, validUntil: 20271231n,
};
const crit: AwardCriteria = {
  minGpa: 350n, programId: 101n, requireEnrolled: true,
  maxFinancialNeed: 8000n, minCredits: 60n, referenceDate: 20261001n,
};

describe('failedCriteria', () => {
  it('reports nothing for an eligible record', () => {
    expect(failedCriteria(base, crit)).toEqual([]);
  });

  it('names every failing criterion at once', () => {
    const bad = { gpa: 100n, programId: 9n, enrolled: false, financialNeed: 9999n, completedCredits: 1n, validUntil: 1n };
    expect(failedCriteria(bad, crit)).toEqual(['gpa', 'program', 'enrolled', 'financialNeed', 'credits', 'validity']);
  });

  it('treats programId 0 as any program', () => {
    expect(satisfiesCriteria({ ...base, programId: 777n }, { ...crit, programId: 0n })).toBe(true);
  });

  it('treats maxFinancialNeed 0 as no cap', () => {
    expect(satisfiesCriteria({ ...base, financialNeed: 65535n }, { ...crit, maxFinancialNeed: 0n })).toBe(true);
  });

  it('ignores enrollment when not required', () => {
    expect(satisfiesCriteria({ ...base, enrolled: false }, { ...crit, requireEnrolled: false })).toBe(true);
  });
});

// Deterministic generator so failures are reproducible.
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % max;
  };
}

describe('differential: TypeScript mirror vs compiled circuit', () => {
  it('agrees on 500 generated record/criteria pairs, including edges', () => {
    const rnd = lcg(20261003);
    let accepted = 0;
    for (let i = 0; i < 500; i++) {
      const c: AwardCriteria = {
        minGpa: BigInt(rnd(401)),
        programId: BigInt(rnd(3) === 0 ? 0 : 100 + rnd(3)),
        requireEnrolled: rnd(2) === 0,
        maxFinancialNeed: BigInt(rnd(4) === 0 ? 0 : rnd(10000)),
        minCredits: BigInt(rnd(121)),
        referenceDate: BigInt(20260000 + rnd(20000)),
      };
      const nudge = (v: bigint) => {
        const n = v + BigInt(rnd(3)) - 1n;
        return n < 0n ? 0n : n;
      };
      const r: AcademicRecord = {
        gpa: nudge(c.minGpa),
        programId: BigInt(100 + rnd(3)),
        enrolled: rnd(4) !== 0,
        financialNeed: BigInt(rnd(10000)),
        completedCredits: nudge(c.minCredits),
        validUntil: nudge(c.referenceDate),
      };
      const ts = satisfiesCriteria(r, c);
      expect(pureCircuits.satisfiesCriteria(r, c), JSON.stringify({ r, c }, (_, v) => typeof v === 'bigint' ? v.toString() : v)).toBe(ts);
      if (ts) accepted++;
    }
    // Make sure the sample exercises both outcomes, not just one.
    expect(accepted).toBeGreaterThan(25);
    expect(accepted).toBeLessThan(475);
  });
});
