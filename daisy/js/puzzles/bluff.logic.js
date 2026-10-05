// The Bluff: Halloran asks three questions; Patel's real answers are in his mail, his todo and his finger plan. Pure.
export const bluffOutcome = (wrong) => (wrong <= 0 ? 'clean' : wrong === 1 ? 'suspicious' : 'burned');

// A reply without Patel's signature, as someone would quote it back.
export const unsign = (text) => text.replace(/\s*(-kp|—\s*K\. Patel)\s*$/i, '').trim();

export function createBluff(exchanges) {
  const results = exchanges.map(() => null); // null | 'right' | 'wrong'
  const wrong = () => results.filter((r) => r === 'wrong').length;
  const answer = (i, pick) => {
    if (!exchanges[i] || results[i] !== null) return null; // late, double or stray input never re-scores
    results[i] = exchanges[i].replies[pick]?.right === true ? 'right' : 'wrong';
    return results[i];
  };
  return {
    answer,
    timeout: (i) => answer(i, -1),
    get wrong() { return wrong(); },
    get done() { return results.every((r) => r !== null); },
    outcome: () => bluffOutcome(wrong()),
  };
}

export function validateBluff(p) {
  const errors = [];
  if (!Array.isArray(p?.exchanges) || p.exchanges.length !== 3) errors.push('bluff needs exactly 3 exchanges');
  (p?.exchanges ?? []).forEach((x, i) => {
    if (typeof x.says !== 'string' || !x.says) errors.push(`exchange ${i}: needs says`);
    if (x.replies?.length !== 3) errors.push(`exchange ${i}: needs 3 replies`);
    if ((x.replies ?? []).filter((r) => r.right === true).length !== 1) errors.push(`exchange ${i}: needs exactly one right reply`);
  });
  if (!(p?.seconds > 0)) errors.push('bluff needs seconds');
  return errors;
}
