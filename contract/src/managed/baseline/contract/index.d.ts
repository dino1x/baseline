import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum FundingStatus { accepting = 0, finalized = 1 }

export enum EntryStatus { pending = 0, awarded = 1, collected = 2 }

export type AcademicRecord = { gpa: bigint;
                               programId: bigint;
                               enrolled: boolean;
                               financialNeed: bigint;
                               completedCredits: bigint;
                               validUntil: bigint
                             };

export type AwardCriteria = { minGpa: bigint;
                              programId: bigint;
                              requireEnrolled: boolean;
                              maxFinancialNeed: bigint;
                              minCredits: bigint;
                              referenceDate: bigint
                            };

export type Witnesses<PS> = {
  privateKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  heldRecord(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, AcademicRecord];
  recordSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  recordPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
             commitment_0: Uint8Array): [PS, { leaf: Uint8Array,
                                               path: { sibling: { field: bigint
                                                                },
                                                       goes_left: boolean
                                                     }[]
                                             }];
}

export type ImpureCircuits<PS> = {
  addRecord(context: __compactRuntime.CircuitContext<PS>,
            commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  createFunding(context: __compactRuntime.CircuitContext<PS>,
                fundingId_0: Uint8Array,
                criteria_0: AwardCriteria): Promise<__compactRuntime.CircuitResults<PS, []>>;
  commitSeedLock(context: __compactRuntime.CircuitContext<PS>,
                 fundingId_0: Uint8Array,
                 lock_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  submitEntry(context: __compactRuntime.CircuitContext<PS>,
              fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  closeFunding(context: __compactRuntime.CircuitContext<PS>,
               fundingId_0: Uint8Array,
               seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  generateDrawTicket(context: __compactRuntime.CircuitContext<PS>,
                     fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  awardEntry(context: __compactRuntime.CircuitContext<PS>,
             fundingId_0: Uint8Array,
             receipt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  collectAward(context: __compactRuntime.CircuitContext<PS>,
               fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type ProvableCircuits<PS> = {
  addRecord(context: __compactRuntime.CircuitContext<PS>,
            commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  createFunding(context: __compactRuntime.CircuitContext<PS>,
                fundingId_0: Uint8Array,
                criteria_0: AwardCriteria): Promise<__compactRuntime.CircuitResults<PS, []>>;
  commitSeedLock(context: __compactRuntime.CircuitContext<PS>,
                 fundingId_0: Uint8Array,
                 lock_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  submitEntry(context: __compactRuntime.CircuitContext<PS>,
              fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  closeFunding(context: __compactRuntime.CircuitContext<PS>,
               fundingId_0: Uint8Array,
               seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  generateDrawTicket(context: __compactRuntime.CircuitContext<PS>,
                     fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  awardEntry(context: __compactRuntime.CircuitContext<PS>,
             fundingId_0: Uint8Array,
             receipt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  collectAward(context: __compactRuntime.CircuitContext<PS>,
               fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type PureCircuits = {
  registrarKey(sk_0: Uint8Array): Uint8Array;
  committeeKey(sk_0: Uint8Array): Uint8Array;
  applicantKey(sk_0: Uint8Array): Uint8Array;
  receiptFor(sk_0: Uint8Array, fundingId_0: Uint8Array): Uint8Array;
  drawSeedFor(sk_0: Uint8Array, fundingId_0: Uint8Array): Uint8Array;
  seedLockOf(seed_0: Uint8Array): Uint8Array;
  drawTicketFor(seed_0: Uint8Array, receipt_0: Uint8Array): Uint8Array;
  recordCommitment(r_0: AcademicRecord, holder_0: Uint8Array, salt_0: Uint8Array): Uint8Array;
  satisfiesCriteria(record_0: AcademicRecord, criteria_0: AwardCriteria): boolean;
}

export type Circuits<PS> = {
  registrarKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  committeeKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  applicantKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  receiptFor(context: __compactRuntime.CircuitContext<PS>,
             sk_0: Uint8Array,
             fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  drawSeedFor(context: __compactRuntime.CircuitContext<PS>,
              sk_0: Uint8Array,
              fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  seedLockOf(context: __compactRuntime.CircuitContext<PS>, seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  drawTicketFor(context: __compactRuntime.CircuitContext<PS>,
                seed_0: Uint8Array,
                receipt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  recordCommitment(context: __compactRuntime.CircuitContext<PS>,
                   r_0: AcademicRecord,
                   holder_0: Uint8Array,
                   salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  satisfiesCriteria(context: __compactRuntime.CircuitContext<PS>,
                    record_0: AcademicRecord,
                    criteria_0: AwardCriteria): Promise<__compactRuntime.CircuitResults<PS, boolean>>;
  addRecord(context: __compactRuntime.CircuitContext<PS>,
            commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  createFunding(context: __compactRuntime.CircuitContext<PS>,
                fundingId_0: Uint8Array,
                criteria_0: AwardCriteria): Promise<__compactRuntime.CircuitResults<PS, []>>;
  commitSeedLock(context: __compactRuntime.CircuitContext<PS>,
                 fundingId_0: Uint8Array,
                 lock_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  submitEntry(context: __compactRuntime.CircuitContext<PS>,
              fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  closeFunding(context: __compactRuntime.CircuitContext<PS>,
               fundingId_0: Uint8Array,
               seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  generateDrawTicket(context: __compactRuntime.CircuitContext<PS>,
                     fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  awardEntry(context: __compactRuntime.CircuitContext<PS>,
             fundingId_0: Uint8Array,
             receipt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  collectAward(context: __compactRuntime.CircuitContext<PS>,
               fundingId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type Ledger = {
  readonly registrar: Uint8Array;
  records: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  readonly recordCount: bigint;
  fundings: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): AwardCriteria;
    [Symbol.iterator](): Iterator<[Uint8Array, AwardCriteria]>
  };
  entries: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): {
      isEmpty(): boolean;
      size(): bigint;
      member(key_1: Uint8Array): boolean;
      lookup(key_1: Uint8Array): EntryStatus;
      [Symbol.iterator](): Iterator<[Uint8Array, EntryStatus]>
    }
  };
  entryCount: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { read(): bigint }
  };
  awardCount: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { read(): bigint }
  };
  seedLocks: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  revealedSeeds: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
}

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
