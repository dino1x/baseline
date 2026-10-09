// SPDX-License-Identifier: Apache-2.0
//
// Every test here executes the compiled baseline contract through the
// compact-runtime. A rejected transaction is a thrown assertion from inside
// the circuit, which is exactly what a prover would refuse to prove.

import { describe, it, expect, beforeEach } from 'vitest';
import { Ledgerbook, type Participant } from '../../contract/src/simulator';
import {
  EntryStatus,
  pureCircuits,
  type AcademicRecord,
  type AwardCriteria,
} from '../../contract/src/managed/baseline/contract/index.js';

const key = (n: number) => new Uint8Array(32).fill(n);
const id = (s: string) => {
  const b = new Uint8Array(32);
  b.set(new TextEncoder().encode(s).subarray(0, 32));
  return b;
};

const REGISTRAR = key(1);
const COMMITTEE = key(2);
const ALICE = key(10);
const BOB = key(11);
const MALLORY = key(66);
const FUND = id('stem-2026');

const criteria: AwardCriteria = {
  minGpa: 350n,
  programId: 101n,
  requireEnrolled: true,
  maxFinancialNeed: 8000n,
  minCredits: 60n,
  referenceDate: 20261001n,
};

const strong: AcademicRecord = {
  gpa: 385n,
  programId: 101n,
  enrolled: true,
  financialNeed: 4500n,
  completedCredits: 74n,
  validUntil: 20271231n,
};

async function enrol(net: Ledgerbook, sk: Uint8Array, rec: AcademicRecord, saltByte: number) {
  const salt = key(saltByte);
  const commitment = pureCircuits.recordCommitment(rec, pureCircuits.applicantKey(sk), salt);
  await net.join(REGISTRAR).addRecord(commitment);
  return net.join(sk, rec, salt);
}

describe('deployment', () => {
  it('seals the registrar public key derived from the deployer secret', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    expect(net.ledger().registrar).toEqual(pureCircuits.registrarKey(REGISTRAR));
    expect(net.ledger().recordCount).toBe(0n);
    expect(net.ledger().fundings.isEmpty()).toBe(true);
  });
});

describe('addRecord', () => {
  it('accepts a commitment from the registrar and grows the tree', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(REGISTRAR).addRecord(key(7));
    await net.join(REGISTRAR).addRecord(key(8));
    expect(net.ledger().recordCount).toBe(2n);
    expect(net.ledger().records.findPathForLeaf(key(7))).toBeDefined();
  });

  it('rejects a commitment from anyone else', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    await expect(net.join(MALLORY).addRecord(key(7))).rejects.toThrow(/Only registrar/);
    expect(net.ledger().recordCount).toBe(0n);
  });
});

describe('createFunding', () => {
  it('publishes criteria and empty counters', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(COMMITTEE).createFunding(FUND, criteria);
    expect(net.ledger().fundings.lookup(FUND)).toEqual(criteria);
    expect(net.ledger().entryCount.lookup(FUND).read()).toBe(0n);
  });

  it('rejects a duplicate funding id', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(COMMITTEE).createFunding(FUND, criteria);
    await expect(net.join(COMMITTEE).createFunding(FUND, criteria)).rejects.toThrow(/Funding exists/);
  });
});

describe('submitEntry', () => {
  let net: Ledgerbook;
  beforeEach(async () => {
    net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(COMMITTEE).createFunding(FUND, criteria);
  });

  it('accepts an eligible holder and records only the receipt', async () => {
    const alice = await enrol(net, ALICE, strong, 31);
    const receipt = await alice.submitEntry(FUND);
    expect(receipt).toEqual(pureCircuits.receiptFor(ALICE, FUND));
    expect(net.ledger().entries.lookup(FUND).lookup(receipt)).toBe(EntryStatus.pending);
    expect(net.ledger().entryCount.lookup(FUND).read()).toBe(1n);
  });

  const failing: Array<[string, Partial<AcademicRecord>]> = [
    ['gpa below minimum', { gpa: 349n }],
    ['wrong program', { programId: 202n }],
    ['not enrolled', { enrolled: false }],
    ['financial need above cap', { financialNeed: 8001n }],
    ['too few credits', { completedCredits: 59n }],
    ['record expired before reference date', { validUntil: 20260930n }],
  ];
  for (const [name, patch] of failing) {
    it(`rejects a holder whose record fails: ${name}`, async () => {
      const holder = await enrol(net, ALICE, { ...strong, ...patch }, 32);
      await expect(holder.submitEntry(FUND)).rejects.toThrow(/does not meet award criteria/);
      expect(net.ledger().entryCount.lookup(FUND).read()).toBe(0n);
    });
  }

  it('accepts records exactly on every boundary', async () => {
    const edge: AcademicRecord = {
      gpa: 350n, programId: 101n, enrolled: true,
      financialNeed: 8000n, completedCredits: 60n, validUntil: 20261001n,
    };
    const holder = await enrol(net, ALICE, edge, 33);
    await expect(holder.submitEntry(FUND)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('rejects a second entry by the same holder', async () => {
    const alice = await enrol(net, ALICE, strong, 34);
    await alice.submitEntry(FUND);
    await expect(alice.submitEntry(FUND)).rejects.toThrow(/Already entered/);
  });

  it('rejects a record the registrar never issued', async () => {
    const forger = net.join(MALLORY, strong, key(35));
    await expect(forger.submitEntry(FUND)).rejects.toThrow(/not in the registrar tree/);
  });

  it('rejects a holder presenting someone else\'s record', async () => {
    await enrol(net, ALICE, strong, 36);
    const thief = net.join(MALLORY, strong, key(36));
    await expect(thief.submitEntry(FUND)).rejects.toThrow(/not in the registrar tree/);
  });

  it('rejects an entry to an unknown funding', async () => {
    const alice = await enrol(net, ALICE, strong, 37);
    await expect(alice.submitEntry(id('nope'))).rejects.toThrow(/Unknown funding/);
  });

  it('gives the same holder unlinkable receipts across fundings', async () => {
    const other = id('arts-2026');
    await net.join(COMMITTEE).createFunding(other, { ...criteria, programId: 0n });
    const alice = await enrol(net, ALICE, strong, 38);
    const r1 = await alice.submitEntry(FUND);
    const r2 = await alice.submitEntry(other);
    expect(r1).not.toEqual(r2);
  });
});

describe('selection and claim', () => {
  let net: Ledgerbook;
  let alice: Participant;
  let bob: Participant;
  let ra: Uint8Array;
  let rb: Uint8Array;
  beforeEach(async () => {
    net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(COMMITTEE).createFunding(FUND, criteria);
    alice = await enrol(net, ALICE, strong, 41);
    bob = await enrol(net, BOB, strong, 42);
    ra = await alice.submitEntry(FUND);
    rb = await bob.submitEntry(FUND);
    await net.join(COMMITTEE).closeFunding(FUND, key(99));
  });

  it('stores the revealed seed on close', () => {
    expect(net.ledger().revealedSeeds.lookup(FUND)).toEqual(key(99));
  });

  it('awards a pending receipt', async () => {
    await net.join(COMMITTEE).awardEntry(FUND, ra);
    expect(net.ledger().entries.lookup(FUND).lookup(ra)).toBe(EntryStatus.awarded);
    expect(net.ledger().awardCount.lookup(FUND).read()).toBe(1n);
  });

  it('refuses to award the same receipt twice', async () => {
    await net.join(COMMITTEE).awardEntry(FUND, ra);
    await expect(net.join(COMMITTEE).awardEntry(FUND, ra)).rejects.toThrow(/not pending/);
  });

  it('refuses to award a receipt that was never filed', async () => {
    await expect(net.join(COMMITTEE).awardEntry(FUND, key(5))).rejects.toThrow(/Unknown receipt/);
  });

  it('lets the winner collect with only their secret', async () => {
    await net.join(COMMITTEE).awardEntry(FUND, ra);
    const r = await alice.collectAward(FUND);
    expect(r).toEqual(ra);
    expect(net.ledger().entries.lookup(FUND).lookup(ra)).toBe(EntryStatus.collected);
  });

  it('refuses collection by an applicant who was not awarded', async () => {
    await net.join(COMMITTEE).awardEntry(FUND, ra);
    await expect(bob.collectAward(FUND)).rejects.toThrow(/Not awarded/);
    expect(net.ledger().entries.lookup(FUND).lookup(rb)).toBe(EntryStatus.pending);
  });

  it('refuses collection by someone who never applied', async () => {
    await net.join(COMMITTEE).awardEntry(FUND, ra);
    await expect(net.join(MALLORY).collectAward(FUND)).rejects.toThrow(/No entry for holder/);
  });

  it('refuses a second collection', async () => {
    await net.join(COMMITTEE).awardEntry(FUND, ra);
    await alice.collectAward(FUND);
    await expect(alice.collectAward(FUND)).rejects.toThrow(/Not awarded/);
  });
});

describe('privacy of the public ledger', () => {
  const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

  it('never writes the applicant secret, salt or holder key to public state', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(COMMITTEE).createFunding(FUND, criteria);
    const salt = key(0xa7);
    const sk = new Uint8Array(32).map((_, i) => (i * 37 + 11) & 0xff);
    const commitment = pureCircuits.recordCommitment(strong, pureCircuits.applicantKey(sk), salt);
    await net.join(REGISTRAR).addRecord(commitment);
    await net.join(sk, strong, salt).submitEntry(FUND);

    const l = net.ledger();
    const pub = [
      hex(l.registrar),
      ...[...l.entries.lookup(FUND)].map(([k]) => hex(k)),
      ...[...l.revealedSeeds].map(([, v]) => hex(v)),
    ].join('');
    expect(pub).not.toContain(hex(sk));
    expect(pub).not.toContain(hex(salt));
    expect(pub).not.toContain(hex(pureCircuits.applicantKey(sk)));
  });

  it('the witnesses did supply the private record to the circuit', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(COMMITTEE).createFunding(FUND, criteria);
    const alice = await enrol(net, ALICE, strong, 51);
    await alice.submitEntry(FUND);
    const used = new Set(net.witnessLog.map(w => w.witness));
    expect(used).toEqual(new Set(['privateKey', 'heldRecord', 'recordSalt', 'recordPath']));
  });

  it('enforces commit-reveal entropy locks and generates verifiable draw tickets', async () => {
    const net = await Ledgerbook.deploy(REGISTRAR);
    await net.join(COMMITTEE).createFunding(FUND, criteria);

    const secretSeed = new Uint8Array(32).fill(42);
    const lock = pureCircuits.seedLockOf(secretSeed);
    await net.join(REGISTRAR).commitSeedLock(FUND, lock);

    const alice = await enrol(net, ALICE, strong, 51);
    await alice.submitEntry(FUND);

    // Revealing fake seed throws mismatch error
    const fakeSeed = new Uint8Array(32).fill(99);
    await expect(net.join(REGISTRAR).closeFunding(FUND, fakeSeed)).rejects.toThrow(
      'Revealed seed does not match seed lock commitment',
    );

    // Revealing true seed succeeds
    await net.join(REGISTRAR).closeFunding(FUND, secretSeed);

    // Candidate generates draw ticket
    const ticket = await alice.generateDrawTicket(FUND);
    expect(ticket).toHaveLength(32);
  });
});

