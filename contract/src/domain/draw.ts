// SPDX-License-Identifier: Apache-2.0
//
// Draw ordering for a closed funding. Tickets come from the compiled
// drawTicketFor circuit so anyone can recompute the order from public data.

import { pureCircuits } from '../managed/baseline/contract/index.js';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

/** Receipts sorted by ascending ticket; the first `slots` are the winners. */
export function rankReceipts(seed: Uint8Array, receipts: Uint8Array[]): Uint8Array[] {
  return [...receipts]
    .map(r => ({ r, t: hex(pureCircuits.drawTicketFor(seed, r)) }))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
    .map(x => x.r);
}

export function winners(seed: Uint8Array, receipts: Uint8Array[], slots: number): Uint8Array[] {
  return rankReceipts(seed, receipts).slice(0, slots);
}

/** True if a revealed seed matches the lock published before intake opened. */
export function seedMatchesLock(seed: Uint8Array, lock: Uint8Array): boolean {
  return hex(pureCircuits.seedLockOf(seed)) === hex(lock);
}
