import { describe, it, expect } from 'vitest';
import { rankReceipts, winners, seedMatchesLock } from '../../contract/src/domain/draw';
import { pureCircuits } from '../../contract/src/managed/baseline/contract/index.js';

const k = (n: number) => new Uint8Array(32).fill(n);
const receipts = [1, 2, 3, 4, 5, 6].map(k);

describe('draw ordering', () => {
  it('is deterministic for a given seed', () => {
    expect(rankReceipts(k(9), receipts)).toEqual(rankReceipts(k(9), receipts));
  });

  it('does not depend on submission order', () => {
    expect(rankReceipts(k(9), [...receipts].reverse())).toEqual(rankReceipts(k(9), receipts));
  });

  it('changes when the seed changes', () => {
    expect(rankReceipts(k(9), receipts)).not.toEqual(rankReceipts(k(10), receipts));
  });

  it('returns exactly the requested number of winners', () => {
    expect(winners(k(9), receipts, 2)).toHaveLength(2);
    expect(winners(k(9), receipts, 99)).toHaveLength(6);
  });

  it('verifies a revealed seed against its published lock', () => {
    const lock = pureCircuits.seedLockOf(k(9));
    expect(seedMatchesLock(k(9), lock)).toBe(true);
    expect(seedMatchesLock(k(10), lock)).toBe(false);
  });
});

describe('pure circuit hashing', () => {
  it('derives different public keys for each role from one secret', () => {
    const sk = k(42);
    const keys = [pureCircuits.registrarKey(sk), pureCircuits.committeeKey(sk), pureCircuits.applicantKey(sk)]
      .map(b => Buffer.from(b).toString('hex'));
    expect(new Set(keys).size).toBe(3);
  });

  it('binds the record commitment to every field, the holder and the salt', () => {
    const r = { gpa: 385n, programId: 101n, enrolled: true, financialNeed: 4500n, completedCredits: 74n, validUntil: 20271231n };
    const c0 = pureCircuits.recordCommitment(r, k(1), k(2));
    expect(pureCircuits.recordCommitment(r, k(1), k(2))).toEqual(c0);
    expect(pureCircuits.recordCommitment({ ...r, gpa: 386n }, k(1), k(2))).not.toEqual(c0);
    expect(pureCircuits.recordCommitment({ ...r, enrolled: false }, k(1), k(2))).not.toEqual(c0);
    expect(pureCircuits.recordCommitment(r, k(3), k(2))).not.toEqual(c0);
    expect(pureCircuits.recordCommitment(r, k(1), k(3))).not.toEqual(c0);
  });

  it('keeps receipt and draw-seed domains apart for the same inputs', () => {
    expect(pureCircuits.receiptFor(k(1), k(2))).not.toEqual(pureCircuits.drawSeedFor(k(1), k(2)));
  });
});
