// SPDX-License-Identifier: Apache-2.0
//
// Deterministic in-process execution harness for the Baseline academic bursary
// contract. Simulates multi-party interaction (University Registrar, Scholarship
// Committee, and Student Applicants) against the compiled Compact circuits.

import {
  type CircuitContext,
  type CircuitResults,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  type AcademicRecord,
  type AwardCriteria,
  Contract as CompiledBaselineContract,
  type Ledger as RegistrarLedgerView,
  ledger as projectPublicLedger,
  type Witnesses as ContractWitnessTable,
} from './managed/baseline/contract/index.js';
import {
  type BaselinePrivateState,
  buildDossierHoldings,
  witnesses as rawWitnessTable,
} from './witnesses.js';

type OnChainStateSnapshot = Parameters<
  typeof createCircuitContext<BaselinePrivateState>
>[0]['contractState'];

type ImpureCircuitMap = CompiledBaselineContract<BaselinePrivateState>['impureCircuits'];

const ZERO_ZSWAP_COIN_PUBLIC_KEY = '00'.repeat(32);

export interface WitnessCall {
  readonly witness: string;
  readonly value: unknown;
}

/**
 * Create a proxy witness suite that records every witness invocation into
 * `sink` before returning the witness value to the circuit runtime.
 */
function buildAuditedContractInstance(
  sink: WitnessCall[],
): CompiledBaselineContract<BaselinePrivateState> {
  const instrumented: Record<string, (...args: unknown[]) => unknown> = {};

  for (const [hookName, handler] of Object.entries(rawWitnessTable)) {
    instrumented[hookName] = (...invocationArgs: unknown[]) => {
      const pair = (handler as (...a: unknown[]) => [BaselinePrivateState, unknown])(
        ...invocationArgs,
      );
      sink.push({ witness: hookName, value: pair[1] });
      return pair;
    };
  }

  return new CompiledBaselineContract<BaselinePrivateState>(
    instrumented as unknown as ContractWitnessTable<BaselinePrivateState>,
  );
}

/**
 * Shared ledger environment holding the public contract state and witness audit trail.
 */
export class Ledgerbook {
  public readonly address = sampleContractAddress();
  public readonly witnessLog: WitnessCall[] = [];
  public contractState: OnChainStateSnapshot;

  private constructor(initialSnapshot: OnChainStateSnapshot) {
    this.contractState = initialSnapshot;
  }

  static async deploy(registrarSecret: Uint8Array): Promise<Ledgerbook> {
    const bootstrapContract = new CompiledBaselineContract<BaselinePrivateState>(rawWitnessTable);
    const deployerContext = createConstructorContext<BaselinePrivateState>(
      buildDossierHoldings(registrarSecret),
      ZERO_ZSWAP_COIN_PUBLIC_KEY,
    );
    const genesis = await bootstrapContract.initialState(deployerContext);
    return new Ledgerbook(genesis.currentContractState.data);
  }

  join(
    secretKey: Uint8Array,
    record?: AcademicRecord,
    salt?: Uint8Array,
  ): Participant {
    return new Participant(this, buildDossierHoldings(secretKey, record, salt));
  }

  ledger(): RegistrarLedgerView {
    return projectPublicLedger(
      this.contractState as Parameters<typeof projectPublicLedger>[0],
    );
  }

  async call<R>(
    actor: Participant,
    circuitName: string,
    invoke: (
      contract: CompiledBaselineContract<BaselinePrivateState>,
      ctx: CircuitContext<BaselinePrivateState>,
    ) => Promise<CircuitResults<BaselinePrivateState, R>>,
  ): Promise<R> {
    const executionCtx = createCircuitContext<BaselinePrivateState>({
      circuitId: circuitName,
      contractAddress: this.address,
      coinPublicKeyOrZswapState: ZERO_ZSWAP_COIN_PUBLIC_KEY,
      contractState: this.contractState,
      privateState: actor.state,
    });

    const contractWithAudit = buildAuditedContractInstance(this.witnessLog);
    const outcome = await invoke(contractWithAudit, executionCtx);

    this.contractState = outcome.context.callContext.currentQueryContext.state;
    if (outcome.context.callContext.currentPrivateState !== undefined) {
      actor.state = outcome.context.callContext.currentPrivateState;
    }
    return outcome.result;
  }
}

/**
 * Represents an individual actor (Registrar, Bursar Committee, or Student Applicant)
 * holding private credentials and invoking circuits against a shared Ledgerbook.
 */
export class Participant {
  public state: BaselinePrivateState;
  private readonly hostLedger: Ledgerbook;

  constructor(hostLedger: Ledgerbook, initialHoldings: BaselinePrivateState) {
    this.hostLedger = hostLedger;
    this.state = initialHoldings;
  }

  private dispatch<K extends keyof ImpureCircuitMap>(
    circuitKey: K,
    ...params: Parameters<ImpureCircuitMap[K]> extends [
      CircuitContext<BaselinePrivateState>,
      ...infer Rest,
    ]
      ? Rest
      : never
  ) {
    return this.hostLedger.call(this, String(circuitKey), (contract, ctx) => {
      const fn = contract.impureCircuits[circuitKey] as (
        c: CircuitContext<BaselinePrivateState>,
        ...p: unknown[]
      ) => Promise<CircuitResults<BaselinePrivateState, unknown>>;
      return fn(ctx, ...params);
    }) as Promise<
      Awaited<ReturnType<ImpureCircuitMap[K]>> extends CircuitResults<
        BaselinePrivateState,
        infer Out
      >
        ? Out
        : never
    >;
  }

  addRecord(commitment: Uint8Array) {
    return this.dispatch('addRecord', commitment);
  }

  createFunding(fundingId: Uint8Array, criteria: AwardCriteria) {
    return this.dispatch('createFunding', fundingId, criteria);
  }

  commitSeedLock(fundingId: Uint8Array, lock: Uint8Array) {
    return this.dispatch('commitSeedLock', fundingId, lock);
  }

  submitEntry(fundingId: Uint8Array) {
    return this.dispatch('submitEntry', fundingId);
  }

  closeFunding(fundingId: Uint8Array, seed: Uint8Array) {
    return this.dispatch('closeFunding', fundingId, seed);
  }

  generateDrawTicket(fundingId: Uint8Array) {
    return this.dispatch('generateDrawTicket', fundingId);
  }

  awardEntry(fundingId: Uint8Array, receipt: Uint8Array) {
    return this.dispatch('awardEntry', fundingId, receipt);
  }

  collectAward(fundingId: Uint8Array) {
    return this.dispatch('collectAward', fundingId);
  }
}
