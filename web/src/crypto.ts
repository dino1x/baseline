// Fast UI preview digest utilities (Web Crypto SHA-256) for immediate interactive feedback.
// Note: These functions are strictly UI previews and are NOT the compiled contract hash.
// Real zero-knowledge circuit execution happens via the compiled Compact contract in chain.ts.

export interface DossierTranscript {
  gpaScaled: number;         // Uint<16>, e.g. 392 represents 3.92 GPA
  programCode: number;       // Uint<32>, academic department code
  activeMatriculation: boolean;
  assessedNeedUsd: number;   // Uint<16>, bursar financial need score
  earnedCredits: number;     // Uint<16>, completed semester hours
  expiryDateCode: number;    // Uint<32>, YYYYMMDD integer
}

export interface BursaryThresholdRules {
  minGpaScaled: number;
  requiredProgramCode: number;
  mustBeMatriculated: boolean;
  maxNeedCapUsd: number;
  minCreditsRequired: number;
  ordinanceDateCode: number;
}

export function bytesToHexStr(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexStrToBytes(hexInput: string): Uint8Array {
  const normalized = hexInput.startsWith('0x') ? hexInput.slice(2) : hexInput;
  const result = new Uint8Array(Math.floor(normalized.length / 2));
  for (let pos = 0; pos < result.length; pos++) {
    result[pos] = parseInt(normalized.slice(pos * 2, pos * 2 + 2), 16);
  }
  return result;
}

function encodeAsciiTag32(tag: string): Uint8Array {
  const raw = new TextEncoder().encode(tag);
  const block = new Uint8Array(32);
  block.set(raw.subarray(0, 32));
  return block;
}

function encodeUint64Be(value: number): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt(Math.max(0, Math.trunc(value))), false);
  return buf;
}

export async function domainDigestPreview(
  domainTag: string,
  ...parts: Array<Uint8Array | string | number | boolean>
): Promise<Uint8Array> {
  const segments: Uint8Array[] = [encodeAsciiTag32(domainTag)];

  for (const item of parts) {
    if (item instanceof Uint8Array) {
      segments.push(item);
    } else if (typeof item === 'string') {
      segments.push(hexStrToBytes(item));
    } else if (typeof item === 'number') {
      segments.push(encodeUint64Be(item));
    } else {
      segments.push(new Uint8Array([item ? 1 : 0]));
    }
  }

  let byteLength = 0;
  for (const seg of segments) {
    byteLength += seg.length;
  }

  const payload = new Uint8Array(byteLength);
  let cursor = 0;
  for (const seg of segments) {
    payload.set(seg, cursor);
    cursor += seg.length;
  }

  const digestBuffer = await crypto.subtle.digest('SHA-256', payload as BufferSource);
  return new Uint8Array(digestBuffer);
}

export async function previewApplicantKey(secretKey: Uint8Array): Promise<Uint8Array> {
  return domainDigestPreview('baseline:applicant:v1', secretKey);
}

export async function previewDossierCommitment(
  transcript: DossierTranscript,
  holderPubKey: Uint8Array,
  blindingSalt: Uint8Array,
): Promise<Uint8Array> {
  return domainDigestPreview(
    'baseline:credential:v1',
    holderPubKey,
    blindingSalt,
    transcript.gpaScaled,
    transcript.programCode,
    transcript.activeMatriculation,
    transcript.assessedNeedUsd,
    transcript.earnedCredits,
    transcript.expiryDateCode,
  );
}

export async function previewNullifierReceipt(
  secretKey: Uint8Array,
  ordinanceHexId: string,
): Promise<Uint8Array> {
  return domainDigestPreview('baseline:receipt:v1', hexStrToBytes(ordinanceHexId), secretKey);
}

export async function previewEntropyDrawTicket(
  receiptBytes: Uint8Array,
  entropySeed: Uint8Array,
): Promise<Uint8Array> {
  return domainDigestPreview('baseline:ticket:v1', receiptBytes, entropySeed);
}

/**
 * UI preview model of the depth-16 HistoricMerkleTree kept by the registrar ledger.
 */
export class HistoricChanceryTreePreview {
  public readonly treeDepth = 16;
  private readonly committedLeaves: Uint8Array[] = [];

  appendLeaf(commitment: Uint8Array): { leafPosition: number; rootDigestHex: string } {
    this.committedLeaves.push(commitment);
    return {
      leafPosition: this.committedLeaves.length - 1,
      rootDigestHex: this.currentRootHex(),
    };
  }

  leafTotal(): number {
    return this.committedLeaves.length;
  }

  allLeavesHex(): string[] {
    return this.committedLeaves.map(bytesToHexStr);
  }

  currentRootHex(): string {
    if (this.committedLeaves.length === 0) {
      return '0'.repeat(64);
    }
    const accumulator = new Uint8Array(32);
    accumulator.set(this.committedLeaves[0]);

    for (let idx = 1; idx < this.committedLeaves.length; idx++) {
      const leaf = this.committedLeaves[idx];
      for (let b = 0; b < 32; b++) {
        accumulator[b] = ((accumulator[b] << 1) ^ leaf[b] ^ idx) & 0xff;
      }
    }
    return bytesToHexStr(accumulator);
  }

  deriveBranchSnapshots(leafIndex: number): {
    leafShort: string;
    branchOneShort: string;
    branchTwoShort: string;
    rootShort: string;
  } {
    const leaf = this.committedLeaves[leafIndex] ?? new Uint8Array(32);
    const hexLeaf = bytesToHexStr(leaf);
    const rootHex = this.currentRootHex();
    const b1 = hexLeaf.slice(0, 6) + rootHex.slice(6, 10);
    const b2 = rootHex.slice(0, 6) + hexLeaf.slice(6, 10);
    return {
      leafShort: `0x${hexLeaf.slice(0, 8)}..`,
      branchOneShort: `0x${b1}..`,
      branchTwoShort: `0x${b2}..`,
      rootShort: `0x${rootHex.slice(0, 8)}..`,
    };
  }
}
