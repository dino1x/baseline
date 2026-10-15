// Local state model for the University Registrar & Academic Dossier Desk preview interface.

import {
  type BursaryThresholdRules,
  bytesToHexStr,
  type DossierTranscript,
  HistoricChanceryTreePreview,
} from './crypto';

export type OrdinanceStage = 'accepting' | 'finalized';
export type FilingStage = 'pending' | 'awarded' | 'collected';

export interface BursaryOrdinance {
  ordinanceId: string;
  title: string;
  bursarCode: string;
  stipendAmount: string;
  grantSlots: number;
  stage: OrdinanceStage;
  rules: BursaryThresholdRules;
}

export interface BursaryReceiptFiling {
  receiptHex: string;
  stage: FilingStage;
  ticketHex?: string;
}

export interface ScholarDossierVault {
  secretKey: Uint8Array;
  holderKey: Uint8Array;
  blindingSalt: Uint8Array;
  transcript: DossierTranscript;
  committedLeafIdx: number | null;
  committedLeafBytes: Uint8Array | null;
}

const DEFAULT_ORDINANCES: BursaryOrdinance[] = [
  {
    ordinanceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    title: 'STEM Fellowship',
    bursarCode: 'ORD-STEM',
    stipendAmount: '$12,500',
    grantSlots: 3,
    stage: 'accepting',
    rules: {
      minGpaScaled: 350,
      requiredProgramCode: 101,
      mustBeMatriculated: true,
      maxNeedCapUsd: 8000,
      minCreditsRequired: 60,
      ordinanceDateCode: 20261001,
    },
  },
  {
    ordinanceId: 'f9e8d7c6b5a43210fedcba9876543210abcdef0123456789abcdef0123456789',
    title: 'First-Gen Grant',
    bursarCode: 'ORD-FGEN',
    stipendAmount: '$9,000',
    grantSlots: 5,
    stage: 'accepting',
    rules: {
      minGpaScaled: 300,
      requiredProgramCode: 0,
      mustBeMatriculated: true,
      maxNeedCapUsd: 15000,
      minCreditsRequired: 30,
      ordinanceDateCode: 20261001,
    },
  },
];

export class ChanceryBursarRegistry {
  public readonly registrarAuthorityHex =
    '4f8a9d12e8b7c3a06145df08b417e23a9d0c6e5b4a3f2e1d0c9b8a7f6e5d4c3b';
  public readonly chanceryTree = new HistoricChanceryTreePreview();
  private readonly ordinances = new Map<string, BursaryOrdinance>();
  private readonly filingsByOrdinance = new Map<string, BursaryReceiptFiling[]>();
  private readonly publishedSeeds = new Map<string, string>();

  constructor() {
    for (const item of DEFAULT_ORDINANCES) {
      this.registerOrdinance({ ...item, rules: { ...item.rules } });
    }
  }

  registerOrdinance(ordinance: BursaryOrdinance): void {
    this.ordinances.set(ordinance.ordinanceId, ordinance);
    if (!this.filingsByOrdinance.has(ordinance.ordinanceId)) {
      this.filingsByOrdinance.set(ordinance.ordinanceId, []);
    }
  }

  listOrdinances(): BursaryOrdinance[] {
    return Array.from(this.ordinances.values());
  }

  getOrdinance(ordinanceId: string): BursaryOrdinance | undefined {
    return this.ordinances.get(ordinanceId);
  }

  ordinanceCount(): number {
    return this.ordinances.size;
  }

  inscribeTranscriptLeaf(commitment: Uint8Array): { leafPosition: number; rootDigestHex: string } {
    return this.chanceryTree.appendLeaf(commitment);
  }

  recordApplicantReceipt(ordinanceId: string, receiptHex: string): void {
    const queue = this.filingsByOrdinance.get(ordinanceId) ?? [];
    if (queue.some((item) => item.receiptHex === receiptHex)) {
      throw new Error('This candidate dossier has already filed a receipt for the selected bursary.');
    }
    queue.push({ receiptHex, stage: 'pending' });
    this.filingsByOrdinance.set(ordinanceId, queue);
  }

  listFilings(ordinanceId: string): BursaryReceiptFiling[] {
    return this.filingsByOrdinance.get(ordinanceId) ?? [];
  }

  totalReceiptCount(): number {
    let sum = 0;
    for (const list of this.filingsByOrdinance.values()) {
      sum += list.length;
    }
    return sum;
  }

  revealedSeedFor(ordinanceId: string): string | undefined {
    return this.publishedSeeds.get(ordinanceId);
  }

  sealEntropyAndClose(ordinanceId: string, seedHex: string): void {
    const target = this.ordinances.get(ordinanceId);
    if (!target) {
      throw new Error('Unknown bursary ordinance identifier.');
    }
    target.stage = 'finalized';
    this.publishedSeeds.set(ordinanceId, seedHex);
  }

  designateAwardee(ordinanceId: string, receiptHex: string, ticketHex: string): void {
    const queue = this.filingsByOrdinance.get(ordinanceId) ?? [];
    const target = queue.find((f) => f.receiptHex === receiptHex);
    if (!target) {
      throw new Error('Receipt nullifier not found in bursary roll.');
    }
    target.stage = 'awarded';
    target.ticketHex = ticketHex;
  }

  disburseGrantToHolder(ordinanceId: string, receiptHex: string): void {
    const queue = this.filingsByOrdinance.get(ordinanceId) ?? [];
    const target = queue.find((f) => f.receiptHex === receiptHex);
    if (!target) {
      throw new Error('No filing receipt on roll for this holder key.');
    }
    if (target.stage === 'collected') {
      throw new Error('Grant stipend has already been collected for this receipt.');
    }
    if (target.stage !== 'awarded') {
      throw new Error('Filing receipt is not marked as awarded.');
    }
    target.stage = 'collected';
  }

  verifyZeroLeakage(vault: ScholarDossierVault): {
    compromised: boolean;
    exposedArtifacts: string[];
  } {
    const serializedPublicState = JSON.stringify({
      registrarAuthority: this.registrarAuthorityHex,
      treeRoot: this.chanceryTree.currentRootHex(),
      leaves: this.chanceryTree.allLeavesHex(),
      ordinances: Array.from(this.ordinances.entries()),
      filings: Array.from(this.filingsByOrdinance.entries()),
      seeds: Array.from(this.publishedSeeds.entries()),
    });

    const exposedArtifacts: string[] = [];
    const saltHex = bytesToHexStr(vault.blindingSalt);
    if (serializedPublicState.includes(saltHex)) {
      exposedArtifacts.push('recordSalt');
    }

    const secretHex = bytesToHexStr(vault.secretKey);
    if (serializedPublicState.includes(secretHex)) {
      exposedArtifacts.push('privateKey');
    }

    return {
      compromised: exposedArtifacts.length > 0,
      exposedArtifacts,
    };
  }
}
