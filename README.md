# baseline

Private academic transcript attestation and blind bursary selection on Midnight (`Compact 0.35.0`).

Students applying for university bursaries or departmental fellowships normally have to hand over raw transcripts and household financial records to every selection panel they apply to. `baseline` keeps the transcript and financial figures on the student's machine while still letting the selection committee verify every eligibility rule on-chain.

## How a bursary round runs

1. **Registrar attestation (`addRecord`)** — The university registrar hashes a student's GPA, faculty program code, matriculation flag, assessed financial need, credit count, and expiry date together with the student's holder key and a 32-byte salt (`recordCommitment`), then inserts only that 32-byte leaf into an on-chain `HistoricMerkleTree<16, Bytes<32>>`.
2. **Ordinance publication (`createFunding`)** — A scholarship committee opens a bursary round with public minimum/maximum thresholds (`AwardCriteria`), capacity slots, and a pre-committed entropy seed hash (`drawSeedFor`).
3. **Zero-knowledge application (`submitEntry`)** — The student proves inside the circuit that their credential leaf sits in a valid historical root of the registrar's Merkle tree and satisfies `satisfiesCriteria` (`gpa >= minGpa`, matching faculty or wildcard `0`, active enrollment, `financialNeed <= maxNeed`, `completedCredits >= minCredits`, `expiresAt >= referenceDate`). The ledger records only an unlinkable nullifier receipt (`baseline:receipt:v1`).
4. **Seed reveal & disbursement (`closeFunding` -> `awardEntry` -> `collectAward`)** — Once intake closes, the committee reveals its entropy seed, ranks candidate receipts via `drawTicketFor`, marks winning receipts as awarded, and the student claims the grant by proving knowledge of the secret key behind the winning receipt.

## Repository layout

- `contract/src/baseline.compact` — Compact source (8 pure helper circuits + 6 ledger-mutating entry points)
- `contract/src/managed/baseline/` — compiled ZKIR v2 circuits and JS runtime bindings
- `contract/src/domain/` — TypeScript reference implementations (`criteria.ts`, `draw.ts`) used for differential testing
- `contract/src/simulator.ts` & `contract/src/witnesses.ts` — in-memory `@midnight-ntwrk/compact-runtime` harness
- `web/` — Chancery & Bursar Dossier Desk interface (runs the compiled contract directly in browser WebAssembly)
- `tests/` — 43 Vitest cases covering circuit boundaries, replay/nullifier guards, Merkle path checks, and 500-case differential fuzzing

## Local development

```bash
npm install
npm test          # 43 contract + domain tests against the compiled runtime
npm run demo      # CLI walkthrough of a full bursary round + zero-leakage check
npm run dev       # start Vite dev server for the Chancery Desk UI
npm run build     # build static web bundle into ./dist
```

## License

Apache-2.0
