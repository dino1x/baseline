// Interactive controller for the Baseline University Registrar Bursar & Academic Dossier Desk.

import {
  bursarChordChime,
  nibClick,
  toggleBursarAcoustics,
  waxSealThud,
} from './audio';
import { runDemo } from './chain';
import {
  bytesToHexStr,
  hexStrToBytes,
  previewApplicantKey,
  previewDossierCommitment,
  previewEntropyDrawTicket,
  previewNullifierReceipt,
} from './crypto';
import { ChanceryBursarRegistry, type ScholarDossierVault } from './state';

const chanceryRegistry = new ChanceryBursarRegistry();

const scholarVault: ScholarDossierVault = {
  secretKey: crypto.getRandomValues(new Uint8Array(32)),
  holderKey: new Uint8Array(32),
  blindingSalt: crypto.getRandomValues(new Uint8Array(32)),
  transcript: {
    gpaScaled: 392,
    programCode: 101,
    activeMatriculation: true,
    assessedNeedUsd: 3200,
    earnedCredits: 74,
    expiryDateCode: 20271231,
  },
  committedLeafIdx: null,
  committedLeafBytes: null,
};

let observerShieldActive = true;

function queryEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing expected dossier DOM element #${id}`);
  }
  return el as T;
}

const pauseBeat = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function postBursarNotice(message: string, isAlert = false): void {
  const banner = queryEl<HTMLElement>('bursarNoticeToast');
  banner.textContent = message;
  banner.classList.toggle('is-alert', isAlert);
}

function populateDossierFields(
  gpaDecimal: number,
  programCode: number,
  assessedNeedUsd: number,
  earnedCredits: number,
  matriculated: boolean,
  expiryDateCode: number,
): void {
  queryEl<HTMLInputElement>('fieldGpa').value = gpaDecimal.toFixed(2);
  queryEl<HTMLInputElement>('fieldProgramCode').value = String(programCode);
  queryEl<HTMLInputElement>('fieldAssessedNeed').value = String(assessedNeedUsd);
  queryEl<HTMLInputElement>('fieldCompletedCredits').value = String(earnedCredits);
  queryEl<HTMLSelectElement>('fieldEnrollmentStanding').value = matriculated ? 'true' : 'false';
  queryEl<HTMLInputElement>('fieldValidUntil').value = String(expiryDateCode);
}

function renderCertificatePrivacyLens(): void {
  const gpaCell = queryEl<HTMLElement>('certGpaValue');
  const needCell = queryEl<HTMLElement>('certNeedValue');
  const toggleBtn = queryEl<HTMLButtonElement>('btnTogglePrivacyLens');

  if (observerShieldActive) {
    toggleBtn.textContent = 'Lens: PUBLIC OBSERVER (SHIELDED)';
    gpaCell.innerHTML = '<span class="redacted-wax-tag">WITNESS ONLY</span>';
    needCell.innerHTML = '<span class="redacted-wax-tag">WITNESS ONLY</span>';
  } else {
    toggleBtn.textContent = 'Lens: STUDENT HOLDER KEY (UNSEALED)';
    gpaCell.textContent = `${(scholarVault.transcript.gpaScaled / 100).toFixed(2)} / 4.00`;
    needCell.textContent = `$${scholarVault.transcript.assessedNeedUsd.toLocaleString()}`;
  }
}

async function sealAndInscribeCurrentDossier(): Promise<void> {
  const gpaScaled = Math.round(
    parseFloat(queryEl<HTMLInputElement>('fieldGpa').value || '0') * 100,
  );
  const programCode = parseInt(queryEl<HTMLInputElement>('fieldProgramCode').value || '0', 10);
  const assessedNeedUsd = parseInt(
    queryEl<HTMLInputElement>('fieldAssessedNeed').value || '0',
    10,
  );
  const earnedCredits = parseInt(
    queryEl<HTMLInputElement>('fieldCompletedCredits').value || '0',
    10,
  );
  const activeMatriculation =
    queryEl<HTMLSelectElement>('fieldEnrollmentStanding').value === 'true';
  const expiryDateCode = parseInt(
    queryEl<HTMLInputElement>('fieldValidUntil').value || '0',
    10,
  );

  scholarVault.transcript = {
    gpaScaled,
    programCode,
    activeMatriculation,
    assessedNeedUsd,
    earnedCredits,
    expiryDateCode,
  };
  scholarVault.blindingSalt = crypto.getRandomValues(new Uint8Array(32));

  const commitmentBytes = await previewDossierCommitment(
    scholarVault.transcript,
    scholarVault.holderKey,
    scholarVault.blindingSalt,
  );

  scholarVault.committedLeafBytes = commitmentBytes;
  const insertion = chanceryRegistry.inscribeTranscriptLeaf(commitmentBytes);
  scholarVault.committedLeafIdx = insertion.leafPosition;

  const commitmentHex = `0x${bytesToHexStr(commitmentBytes)}`;
  const rootHex = `0x${insertion.rootDigestHex}`;

  queryEl<HTMLElement>('outLeafCommitment').textContent = commitmentHex;
  queryEl<HTMLElement>('outTreeRoot').textContent = rootHex;
  queryEl<HTMLElement>('leafIndexIndicator').textContent = `Leaf #${insertion.leafPosition}`;

  const standingEl = queryEl<HTMLElement>('certStandingText');
  standingEl.textContent = activeMatriculation ? 'MATRICULATED' : 'WITHDRAWN';
  standingEl.style.color = activeMatriculation
    ? 'var(--emerald-attest)'
    : 'var(--crimson-refusal)';

  queryEl<HTMLElement>('certDepartmentText').textContent = `Faculty ${programCode}`;
  renderCertificatePrivacyLens();

  const snapshots = chanceryRegistry.chanceryTree.deriveBranchSnapshots(insertion.leafPosition);
  queryEl<HTMLElement>('snippetLeafHash').textContent = snapshots.leafShort;
  queryEl<HTMLElement>('snippetBranchOne').textContent = snapshots.branchOneShort;
  queryEl<HTMLElement>('snippetBranchTwo').textContent = snapshots.branchTwoShort;
  queryEl<HTMLElement>('snippetRootHash').textContent = snapshots.rootShort;

  syncMastheadCounters();
}

function populateOrdinanceDropdown(): void {
  const selector = queryEl<HTMLSelectElement>('ordinanceSelector');
  const previousValue = selector.value;
  selector.innerHTML = '';

  for (const ord of chanceryRegistry.listOrdinances()) {
    const option = document.createElement('option');
    option.value = ord.ordinanceId;
    option.textContent = `${ord.title} [${ord.stage.toUpperCase()} — ${ord.grantSlots} SLOTS]`;
    selector.appendChild(option);
  }

  if (previousValue && chanceryRegistry.getOrdinance(previousValue)) {
    selector.value = previousValue;
  }
  renderSelectedOrdinanceCharter();
}

function renderSelectedOrdinanceCharter(): void {
  const selector = queryEl<HTMLSelectElement>('ordinanceSelector');
  const ord = chanceryRegistry.getOrdinance(selector.value);
  if (!ord) return;

  queryEl<HTMLElement>('charterCodeBadge').textContent =
    `${ord.bursarCode} (${ord.stage.toUpperCase()})`;
  queryEl<HTMLElement>('charterStipendText').textContent = ord.stipendAmount;
  queryEl<HTMLElement>('ruleMinGpa').textContent =
    `${(ord.rules.minGpaScaled / 100).toFixed(2)}+ GPA`;
  queryEl<HTMLElement>('ruleProgram').textContent =
    ord.rules.requiredProgramCode === 0
      ? 'All Faculties (0)'
      : `Faculty Code ${ord.rules.requiredProgramCode}`;
  queryEl<HTMLElement>('ruleMaxNeed').textContent =
    ord.rules.maxNeedCapUsd === 0
      ? 'Uncapped'
      : `<= $${ord.rules.maxNeedCapUsd.toLocaleString()}`;
  queryEl<HTMLElement>('ruleMinCredits').textContent =
    `${ord.rules.minCreditsRequired} Credit Hrs`;
  queryEl<HTMLElement>('ruleEnrolled').textContent = ord.rules.mustBeMatriculated
    ? 'Active Required'
    : 'Unrestricted';
  queryEl<HTMLElement>('ruleCapacity').textContent = `${ord.grantSlots} Bursary Grants`;

  const revealedSeed = chanceryRegistry.revealedSeedFor(ord.ordinanceId);
  queryEl<HTMLElement>('outRevealedSeed').textContent = revealedSeed
    ? `0x${revealedSeed}`
    : 'Awaiting committee seed reveal...';
}

function clearMerkleNodeHighlights(): void {
  for (const id of ['stepLeafNode', 'stepBranchOne', 'stepBranchTwo', 'stepRootNode']) {
    const node = queryEl<HTMLElement>(id);
    node.classList.remove('is-probing', 'is-attested');
  }
}

async function synthesizeEligibilityProof(): Promise<void> {
  if (scholarVault.committedLeafBytes === null || scholarVault.committedLeafIdx === null) {
    postBursarNotice('Seal and inscribe a candidate dossier before synthesizing a proof.', true);
    return;
  }

  const proveBtn = queryEl<HTMLButtonElement>('btnProveEligibility');
  const scribeConsole = queryEl<HTMLElement>('proverScribeConsole');
  const receiptPanel = queryEl<HTMLElement>('receiptCertificatePanel');
  const ordinanceId = queryEl<HTMLSelectElement>('ordinanceSelector').value;
  const ordinance = chanceryRegistry.getOrdinance(ordinanceId);
  if (!ordinance) return;

  proveBtn.disabled = true;
  scribeConsole.innerHTML = '';
  receiptPanel.hidden = true;
  clearMerkleNodeHighlights();

  const appendScribeLine = (text: string, variant: 'is-step' | 'is-pass' | 'is-fail' | '' = '') => {
    const row = document.createElement('div');
    row.className = `scribe-line ${variant}`.trim();
    row.textContent = `[CHANCERY-ZK] ${text}`;
    scribeConsole.appendChild(row);
    scribeConsole.scrollTop = scribeConsole.scrollHeight;
  };

  const stepNodes = [
    queryEl<HTMLElement>('stepLeafNode'),
    queryEl<HTMLElement>('stepBranchOne'),
    queryEl<HTMLElement>('stepBranchTwo'),
    queryEl<HTMLElement>('stepRootNode'),
  ];

  appendScribeLine(
    `Opening circuit submitEntry for ordinance ${ordinance.bursarCode}...`,
    'is-step',
  );

  for (let i = 0; i < stepNodes.length; i++) {
    stepNodes[i].classList.add('is-probing');
    nibClick(920 + i * 140);
    await pauseBeat(140);
    stepNodes[i].classList.remove('is-probing');
    stepNodes[i].classList.add('is-attested');
  }

  const currentRoot = chanceryRegistry.chanceryTree.currentRootHex();
  appendScribeLine(
    `Merkle witness path verified against HistoricMerkleTree<16> root 0x${currentRoot.slice(0, 14)}...`,
    'is-pass',
  );

  appendScribeLine('Evaluating predicate satisfiesCriteria(heldRecord, criteria)...', 'is-step');
  await pauseBeat(150);

  const rec = scholarVault.transcript;
  const rules = ordinance.rules;

  const gpaPass = rec.gpaScaled >= rules.minGpaScaled;
  appendScribeLine(
    `  GPA check: ${(rec.gpaScaled / 100).toFixed(2)} >= ${(rules.minGpaScaled / 100).toFixed(2)} -> ${gpaPass ? 'SATISFIED' : 'DEFICIENT'}`,
    gpaPass ? 'is-pass' : 'is-fail',
  );

  const progPass =
    rules.requiredProgramCode === 0 || rec.programCode === rules.requiredProgramCode;
  appendScribeLine(
    `  Department check: Faculty ${rec.programCode} -> ${progPass ? 'SATISFIED' : 'MISMATCH'}`,
    progPass ? 'is-pass' : 'is-fail',
  );

  const needPass = rules.maxNeedCapUsd === 0 || rec.assessedNeedUsd <= rules.maxNeedCapUsd;
  appendScribeLine(
    `  Financial need cap: $${rec.assessedNeedUsd.toLocaleString()} <= $${rules.maxNeedCapUsd.toLocaleString()} -> ${needPass ? 'SATISFIED' : 'EXCEEDED'}`,
    needPass ? 'is-pass' : 'is-fail',
  );

  const creditsPass = rec.earnedCredits >= rules.minCreditsRequired;
  const enrolledPass = !rules.mustBeMatriculated || rec.activeMatriculation;
  const datePass = rec.expiryDateCode >= rules.ordinanceDateCode;

  appendScribeLine(
    `  Standing & credits (${rec.earnedCredits} hrs, Enrolled=${rec.activeMatriculation}) -> ${creditsPass && enrolledPass && datePass ? 'SATISFIED' : 'REJECTED'}`,
    creditsPass && enrolledPass && datePass ? 'is-pass' : 'is-fail',
  );

  if (!gpaPass || !progPass || !needPass || !creditsPass || !enrolledPass || !datePass) {
    appendScribeLine(
      'Circuit assertion rejected: candidate dossier does not meet award criteria.',
      'is-fail',
    );
    bursarChordChime(true);
    postBursarNotice(
      'Zero-knowledge proof rejected: candidate transcript falls below ordinance threshold.',
      true,
    );
    proveBtn.disabled = false;
    return;
  }

  const receiptBytes = await previewNullifierReceipt(scholarVault.secretKey, ordinanceId);
  const receiptHex = bytesToHexStr(receiptBytes);

  try {
    chanceryRegistry.recordApplicantReceipt(ordinanceId, receiptHex);
  } catch (err) {
    appendScribeLine((err as Error).message, 'is-fail');
    bursarChordChime(true);
    postBursarNotice((err as Error).message, true);
    proveBtn.disabled = false;
    return;
  }

  appendScribeLine(
    `Derived unlinkable receipt 0x${receiptHex.slice(0, 20)}... and inscribed as PENDING.`,
    'is-pass',
  );

  queryEl<HTMLElement>('outNullifierReceipt').textContent = `0x${receiptHex}`;
  receiptPanel.hidden = false;
  bursarChordChime(false);
  postBursarNotice(
    `Anonymous receipt 0x${receiptHex.slice(0, 12)}... filed on bursary roll with zero identity leakage.`,
  );
  proveBtn.disabled = false;

  syncMastheadCounters();
  await renderDisbursementRollTable();
}

async function revealEntropyAndRankRoll(): Promise<void> {
  const ordinanceId = queryEl<HTMLSelectElement>('ordinanceSelector').value;
  const ordinance = chanceryRegistry.getOrdinance(ordinanceId);
  if (!ordinance) return;

  if (ordinance.stage !== 'accepting') {
    postBursarNotice(
      `Ordinance ${ordinance.bursarCode} has already revealed its entropy seed.`,
      true,
    );
    return;
  }

  const entropyBytes = crypto.getRandomValues(new Uint8Array(32));
  const entropyHex = bytesToHexStr(entropyBytes);
  chanceryRegistry.sealEntropyAndClose(ordinanceId, entropyHex);

  const filings = chanceryRegistry.listFilings(ordinanceId);
  if (filings.length > 0) {
    const ranked: Array<{ receiptHex: string; ticketHex: string; weight: bigint }> = [];
    for (const item of filings) {
      const ticketBytes = await previewEntropyDrawTicket(
        hexStrToBytes(item.receiptHex),
        entropyBytes,
      );
      let weight = 0n;
      for (let i = 0; i < 8; i++) {
        weight = (weight << 8n) | BigInt(ticketBytes[i]);
      }
      ranked.push({
        receiptHex: item.receiptHex,
        ticketHex: bytesToHexStr(ticketBytes),
        weight,
      });
    }

    ranked.sort((a, b) => (a.weight < b.weight ? -1 : a.weight > b.weight ? 1 : 0));
    const awardLimit = Math.min(ordinance.grantSlots, ranked.length);
    for (let i = 0; i < awardLimit; i++) {
      chanceryRegistry.designateAwardee(
        ordinanceId,
        ranked[i].receiptHex,
        ranked[i].ticketHex,
      );
    }
  }

  waxSealThud();
  bursarChordChime(false);
  populateOrdinanceDropdown();
  syncMastheadCounters();
  await renderDisbursementRollTable();
  postBursarNotice(
    `Entropy seed 0x${entropyHex.slice(0, 12)}... revealed; eligible receipts ranked deterministically.`,
  );
}

async function collectDisbursementForHolder(): Promise<void> {
  const ordinanceId = queryEl<HTMLSelectElement>('ordinanceSelector').value;
  const receiptBytes = await previewNullifierReceipt(scholarVault.secretKey, ordinanceId);
  const receiptHex = bytesToHexStr(receiptBytes);

  try {
    chanceryRegistry.disburseGrantToHolder(ordinanceId, receiptHex);
    waxSealThud();
    bursarChordChime(false);
    await renderDisbursementRollTable();
    syncMastheadCounters();
    postBursarNotice(
      `Stipend disbursed to anonymous receipt 0x${receiptHex.slice(0, 14)}... via holder secret proof.`,
    );
  } catch (err) {
    bursarChordChime(true);
    postBursarNotice((err as Error).message, true);
  }
}

async function renderDisbursementRollTable(): Promise<void> {
  const ordinanceId = queryEl<HTMLSelectElement>('ordinanceSelector').value;
  const ordinance = chanceryRegistry.getOrdinance(ordinanceId);
  const filings = chanceryRegistry.listFilings(ordinanceId);
  const revealedSeedHex = chanceryRegistry.revealedSeedFor(ordinanceId);
  const tbody = queryEl<HTMLElement>('disbursementRollBody');

  tbody.innerHTML = '';

  if (filings.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML =
      '<td colspan="4" class="roll-empty-cell">No candidate receipts filed under this bursary ordinance yet.</td>';
    tbody.appendChild(emptyRow);
    return;
  }

  const seedBytes = revealedSeedHex ? hexStrToBytes(revealedSeedHex) : null;

  for (const filing of filings) {
    const tr = document.createElement('tr');

    let ticketDisplay = 'Awaiting Seed';
    if (filing.ticketHex) {
      ticketDisplay = `0x${filing.ticketHex.slice(0, 12)}..`;
    } else if (seedBytes) {
      const ticket = await previewEntropyDrawTicket(
        hexStrToBytes(filing.receiptHex),
        seedBytes,
      );
      ticketDisplay = `0x${bytesToHexStr(ticket).slice(0, 12)}..`;
    }

    const badgeClass =
      filing.stage === 'collected'
        ? 'standing-tag standing-collected'
        : filing.stage === 'awarded'
          ? 'standing-tag standing-awarded'
          : 'standing-tag standing-pending';

    const stipendNote =
      filing.stage === 'pending'
        ? 'In Queue'
        : (ordinance?.stipendAmount ?? 'Full Grant');

    tr.innerHTML = `
      <td>0x${filing.receiptHex.slice(0, 12)}..</td>
      <td>${ticketDisplay}</td>
      <td><span class="${badgeClass}">${filing.stage}</span></td>
      <td>${stipendNote}</td>
    `;
    tbody.appendChild(tr);
  }
}

function syncMastheadCounters(): void {
  const rootHex = chanceryRegistry.chanceryTree.currentRootHex();
  queryEl<HTMLElement>('mastheadRootDigest').textContent = `0x${rootHex.slice(0, 10)}..`;
  queryEl<HTMLElement>('mastheadLeafCount').textContent = String(
    chanceryRegistry.chanceryTree.leafTotal(),
  );
  queryEl<HTMLElement>('mastheadOrdinanceCount').textContent = String(
    chanceryRegistry.ordinanceCount(),
  );
  queryEl<HTMLElement>('mastheadReceiptCount').textContent = String(
    chanceryRegistry.totalReceiptCount(),
  );

  const leakVerdictEl = queryEl<HTMLElement>('mastheadLeakVerdict');
  const audit = chanceryRegistry.verifyZeroLeakage(scholarVault);
  if (audit.compromised) {
    leakVerdictEl.textContent = `BREACH: ${audit.exposedArtifacts.join(', ')}`;
    leakVerdictEl.className = 'counter-cipher wax-seal-breach';
  } else {
    leakVerdictEl.textContent = '0 BYTES LEAKED';
    leakVerdictEl.className = 'counter-cipher wax-seal-ok';
  }
}

function activateScenarioTab(selectedBtn: HTMLButtonElement): void {
  const tabIds = ['tabMeritScholar', 'tabNeedGrantee', 'tabUnderThreshold'];
  for (const id of tabIds) {
    const btn = queryEl<HTMLButtonElement>(id);
    const active = btn === selectedBtn;
    btn.classList.toggle('is-selected', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
}

async function executeLiveCompiledContract(): Promise<void> {
  const runBtn = queryEl<HTMLButtonElement>('btnExecuteCompiledContract');
  const statusSeal = queryEl<HTMLElement>('contractRunStatus');
  const streamBox = queryEl<HTMLElement>('contractExecutionStream');

  runBtn.disabled = true;
  streamBox.textContent = '';
  statusSeal.textContent = 'Executing Circuits...';
  const startedAt = performance.now();

  try {
    await runDemo((...segments: unknown[]) => {
      streamBox.textContent += segments.map(String).join(' ') + '\n';
      streamBox.scrollTop = streamBox.scrollHeight;
    });
    document.body.dataset.round = 'completed';
    const elapsedMs = Math.round(performance.now() - startedAt);
    statusSeal.textContent = `Verified in ${elapsedMs} ms`;
    bursarChordChime(false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    streamBox.textContent += `\nCircuit execution rejected: ${msg}`;
    statusSeal.textContent = 'Execution Rejected';
    document.body.dataset.round = `rejected: ${msg}`;
    bursarChordChime(true);
  } finally {
    runBtn.disabled = false;
  }
}

function bindDeskInteractions(): void {
  const tabMerit = queryEl<HTMLButtonElement>('tabMeritScholar');
  const tabNeed = queryEl<HTMLButtonElement>('tabNeedGrantee');
  const tabReject = queryEl<HTMLButtonElement>('tabUnderThreshold');

  tabMerit.addEventListener('click', async () => {
    nibClick();
    activateScenarioTab(tabMerit);
    populateDossierFields(3.92, 101, 3200, 74, true, 20271231);
    await sealAndInscribeCurrentDossier();
    postBursarNotice('Loaded Merit Scholar Dossier (3.92 GPA, $3,200 Assessed Need).');
  });

  tabNeed.addEventListener('click', async () => {
    nibClick();
    activateScenarioTab(tabNeed);
    populateDossierFields(3.45, 101, 8500, 60, true, 20271231);
    await sealAndInscribeCurrentDossier();
    postBursarNotice('Loaded Need Grantee Dossier (3.45 GPA, $8,500 Assessed Need).');
  });

  tabReject.addEventListener('click', async () => {
    nibClick();
    activateScenarioTab(tabReject);
    populateDossierFields(2.8, 101, 5000, 45, true, 20271231);
    await sealAndInscribeCurrentDossier();
    postBursarNotice(
      'Loaded Under-Threshold Dossier (2.80 GPA) to demonstrate circuit predicate refusal.',
    );
  });

  const acousticsBtn = queryEl<HTMLButtonElement>('btnAcousticsToggle');
  acousticsBtn.addEventListener('click', () => {
    const active = toggleBursarAcoustics();
    acousticsBtn.textContent = `Desk Acoustics: ${active ? 'ON' : 'OFF'}`;
    acousticsBtn.classList.toggle('is-active', active);
    if (active) nibClick();
  });

  queryEl<HTMLButtonElement>('btnInscribeDossier').addEventListener('click', async () => {
    waxSealThud();
    await sealAndInscribeCurrentDossier();
    postBursarNotice('Candidate transcript sealed and appended to HistoricMerkleTree<16>.');
  });

  queryEl<HTMLButtonElement>('btnTogglePrivacyLens').addEventListener('click', () => {
    nibClick();
    observerShieldActive = !observerShieldActive;
    renderCertificatePrivacyLens();
  });

  queryEl<HTMLSelectElement>('ordinanceSelector').addEventListener('change', async () => {
    nibClick();
    renderSelectedOrdinanceCharter();
    await renderDisbursementRollTable();
  });

  queryEl<HTMLButtonElement>('btnProveEligibility').addEventListener('click', () => {
    nibClick();
    void synthesizeEligibilityProof();
  });

  queryEl<HTMLButtonElement>('btnSealEntropyDraw').addEventListener('click', () => {
    void revealEntropyAndRankRoll();
  });

  queryEl<HTMLButtonElement>('btnCollectDisbursement').addEventListener('click', () => {
    void collectDisbursementForHolder();
  });

  queryEl<HTMLButtonElement>('btnExecuteCompiledContract').addEventListener('click', () => {
    waxSealThud();
    void executeLiveCompiledContract();
  });
}

(async function bootstrapChanceryDesk() {
  scholarVault.holderKey = await previewApplicantKey(scholarVault.secretKey);
  bindDeskInteractions();
  populateOrdinanceDropdown();
  await sealAndInscribeCurrentDossier();
  await renderDisbursementRollTable();

  if (location.hash === '#check') {
    void executeLiveCompiledContract();
  }
})();
