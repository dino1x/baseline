// SPDX-License-Identifier: Apache-2.0
//
// Off-chain mirror of satisfiesCriteria in baseline.compact. Applicants use it
// to check eligibility before spending time on a proof. The test suite runs it
// side by side with the compiled circuit to keep the two from drifting.

import type { AcademicRecord, AwardCriteria } from '../managed/baseline/contract/index.js';

export type { AcademicRecord, AwardCriteria };

export type CriterionName = 'gpa' | 'program' | 'enrolled' | 'financialNeed' | 'credits' | 'validity';

/** Which individual criteria a record fails. Empty means eligible. */
export function failedCriteria(r: AcademicRecord, c: AwardCriteria): CriterionName[] {
  const out: CriterionName[] = [];
  if (r.gpa < c.minGpa) out.push('gpa');
  if (c.programId !== 0n && r.programId !== c.programId) out.push('program');
  if (c.requireEnrolled && !r.enrolled) out.push('enrolled');
  if (c.maxFinancialNeed !== 0n && r.financialNeed > c.maxFinancialNeed) out.push('financialNeed');
  if (r.completedCredits < c.minCredits) out.push('credits');
  if (r.validUntil < c.referenceDate) out.push('validity');
  return out;
}

export function satisfiesCriteria(r: AcademicRecord, c: AwardCriteria): boolean {
  return failedCriteria(r, c).length === 0;
}
