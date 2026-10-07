// SPDX-License-Identifier: Apache-2.0
//
// Academic Dossier Witness Provider for the Baseline Compact Contract.
//
// Candidate transcripts, blinding salts, and secret keys remain strictly local
// within the holder's memory space. During transaction assembly, the Compact
// runtime invokes these callbacks to populate circuit wires without exposing
// unshielded fields on the public ledger.

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type {
  AcademicRecord,
  Ledger as PublicRegistrarLedger,
  Witnesses as ContractWitnessSuite,
} from './managed/baseline/contract/index.js';

export type { AcademicRecord };

/** Off-chain academic credential vault held by a single protocol actor. */
export interface BaselinePrivateState {
  readonly secretKey: Uint8Array;
  readonly record?: AcademicRecord;
  readonly salt?: Uint8Array;
}

/** Raised when a participant attempts a circuit call without the required local dossier state. */
export class WitnessError extends Error {
  override readonly name = 'WitnessError';

  constructor(detail: string) {
    super(detail);
    Object.setPrototypeOf(this, WitnessError.prototype);
  }
}

type DossierWitnessEnv = WitnessContext<PublicRegistrarLedger, BaselinePrivateState>;

function requireDefined<T>(field: T | undefined, failureReason: string): T {
  if (field === undefined) {
    throw new WitnessError(failureReason);
  }
  return field;
}

/** Constructs an off-chain private state bundle for a registrar, bursar committee, or student. */
export function buildDossierHoldings(
  secretKey: Uint8Array,
  record?: AcademicRecord,
  salt?: Uint8Array,
): BaselinePrivateState {
  return Object.freeze({
    secretKey,
    ...(record !== undefined ? { record } : {}),
    ...(salt !== undefined ? { salt } : {}),
  });
}

export const privateStateFor = buildDossierHoldings;

function provideSecretKey(env: DossierWitnessEnv): [BaselinePrivateState, Uint8Array] {
  return [env.privateState, env.privateState.secretKey];
}

function provideAcademicRecord(env: DossierWitnessEnv): [BaselinePrivateState, AcademicRecord] {
  const transcript = requireDefined(
    env.privateState.record,
    'applicant private state does not contain an issued academic record',
  );
  return [env.privateState, transcript];
}

function provideCommitmentSalt(env: DossierWitnessEnv): [BaselinePrivateState, Uint8Array] {
  const blindingSalt = requireDefined(
    env.privateState.salt,
    'applicant private state is missing the registrar blinding salt',
  );
  return [env.privateState, blindingSalt];
}

function provideMerkleInclusionPath(
  env: DossierWitnessEnv,
  leafCommitment: Uint8Array,
) {
  const merkleProof = env.ledger.records.findPathForLeaf(leafCommitment);
  if (merkleProof === undefined) {
    throw new WitnessError('record commitment is not in the registrar tree');
  }
  return [env.privateState, merkleProof] as [
    BaselinePrivateState,
    NonNullable<typeof merkleProof>,
  ];
}

export const witnesses: ContractWitnessSuite<BaselinePrivateState> = {
  privateKey: provideSecretKey,
  heldRecord: provideAcademicRecord,
  recordSalt: provideCommitmentSalt,
  recordPath: provideMerkleInclusionPath,
};
