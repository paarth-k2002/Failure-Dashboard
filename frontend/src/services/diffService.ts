/**
 * Diff Service
 * Handles line and word-level diff calculations for comparison
 */

import { LogEntry, LineDiff, DiffToken, AlignedLogPair } from '@/types';
import { diffLines, diffWordsWithSpace, diffWords } from 'diff';

/**
 * Helper to ensure correct DiffToken type
 */
const makeToken = (type: 'added' | 'removed' | 'modified' | 'unchanged', content: string): DiffToken => ({
  type,
  content,
});

/**
 * Simple Longest Common Subsequence (LCS) implementation
 * for aligning logs by cleanLogMessage
 */
function lcs(left: LogEntry[], right: LogEntry[]): Array<[number, number]> {
  const m = left.length;
  const n = right.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      // const normalize = (msg: string) =>
      //   msg.replace(/@[a-z0-9]+/gi, ''); // ignore object ids ONLY

      if (
        normalize(left[i - 1].cleanLogMessage) ===
        normalize(right[j - 1].cleanLogMessage)
      ) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS sequence
  const matches: Array<[number, number]> = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    const normalize = (msg: string) =>
      msg.replace(/@[a-z0-9]+/gi, '');

    if (
      normalize(left[i - 1].cleanLogMessage) ===
      normalize(right[j - 1].cleanLogMessage)
    ) {
      matches.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return matches;
}

const normalize = (msg: string) =>
  msg
    .replace(/@[a-z0-9-]+/gi, '')
    .replace(/\{.*?\}/g, '')
    .replace(/\d+/g, '')
    .toLowerCase()
    .trim();

const getWords = (msg: string) =>
  normalize(msg).split(/\s+/).filter(Boolean);

// word overlap score
const similarityScore = (a: string, b: string) => {
  const wa = getWords(a);
  const wb = getWords(b);

  const setA = new Set(wa);
  const setB = new Set(wb);

  let common = 0;
  for (const w of setA) {
    if (setB.has(w)) common++;
  }

  return common / Math.max(setA.size, setB.size);
};

// order bonus (very important)
const orderedMatchBonus = (a: string, b: string) => {
  const wa = getWords(a);
  const wb = getWords(b);

  let match = 0;
  for (let i = 0; i < Math.min(wa.length, wb.length); i++) {
    if (wa[i] === wb[i]) match++;
  }

  return match / Math.min(wa.length || 1, wb.length || 1);
};

// detect garbage logs like [Ljava... or object refs
const hasWeirdToken = (msg: string) =>
  /\[.*?;@|@[a-z0-9]+/i.test(msg);

// FINAL MATCH FUNCTION
const isGoodMatch = (a: string, b: string) => {
  if (!a || !b) return false;

  // reject if one has garbage and other doesn't
  if (hasWeirdToken(a) !== hasWeirdToken(b)) return false;

  const score = similarityScore(a, b);
  const orderScore = orderedMatchBonus(a, b);

  return score * 0.7 + orderScore * 0.3 > 0.65;
};



/**
 * Align two arrays of logs using LCS
 * Returns pairs with null for missing entries on either side
 */
/**
 * Align two arrays of logs using LCS
 * Returns pairs with null for missing entries on either side
 */
export function alignLogs(
  failedLogs: LogEntry[],
  successfulLogs: LogEntry[]
): AlignedLogPair[] {
  const result: AlignedLogPair[] = [];

  let i = 0;
  let j = 0;

  const normalize = (msg: string) =>
    msg.replace(/@[a-z0-9]+/gi, '');

  const findMatchInRight = (leftMsg: string, startJ: number): number => {
    for (let k = startJ + 1; k < successfulLogs.length; k++) {
      if (isGoodMatch(leftMsg, successfulLogs[k].cleanLogMessage)) {
        return k;
      }
    }
    return -1;
  };

  const findMatchInLeft = (rightMsg: string, startI: number): number => {
    for (let k = startI + 1; k < failedLogs.length; k++) {
      if (isGoodMatch(rightMsg, failedLogs[k].cleanLogMessage)) {
        return k;
      }
    }
    return -1;
  };

  while (i < failedLogs.length && j < successfulLogs.length) {
    const leftMsg = failedLogs[i].cleanLogMessage;
    const rightMsg = successfulLogs[j].cleanLogMessage;

    // Perfect match
    if (isGoodMatch(leftMsg, rightMsg)) {
      result.push({
        failed: failedLogs[i],
        successful: successfulLogs[j],
        isMissing: 'none',
      });
      i++;
      j++;
      continue;
    }

    //  Check if LEFT matches later in RIGHT (extra lines in RIGHT)
    const matchIndexRight = findMatchInRight(leftMsg, j);

    //  Check if RIGHT matches later in LEFT (extra lines in LEFT)
    const matchIndexLeft = findMatchInLeft(rightMsg, i);

    //  Decide best shift (IMPORTANT FIX)
    if (matchIndexRight !== -1 && (matchIndexLeft === -1 || matchIndexRight - j <= matchIndexLeft - i)) {
      //  RIGHT has extra lines
      while (j < matchIndexRight) {
        result.push({
          failed: null,
          successful: successfulLogs[j],
          isMissing: 'left',
        });
        j++;
      }
      continue; //  DO NOT force alignment
    }

    if (matchIndexLeft !== -1) {
      //  LEFT has extra lines
      while (i < matchIndexLeft) {
        result.push({
          failed: failedLogs[i],
          successful: null,
          isMissing: 'right',
        });
        i++;
      }
      continue; // DO NOT force alignment
    }

    // fallback: align as mismatch (DO NOT split)
    result.push({
      failed: failedLogs[i],
      successful: successfulLogs[j],
      isMissing: 'none',
    });
    i++;
    j++;
  }

  // Remaining LEFT
  while (i < failedLogs.length) {
    result.push({
      failed: failedLogs[i],
      successful: null,
      isMissing: 'right',
    });
    i++;
  }

  // Remaining RIGHT
  while (j < successfulLogs.length) {
    result.push({
      failed: null,
      successful: successfulLogs[j],
      isMissing: 'left',
    });
    j++;
  }

  return result;
}


/**
 * Split logs into fine-grained tokens and calculate word-level diffs
 */

export function calculateWordDiff(left: string, right: string) {
  // Tokenize: words, numbers, punctuation, colons, pipes, commas, spaces
  const tokenize = (text: string) =>
    text.match(/[\w]+|[:|,]+|\s+|[^\s\w:|,]+/g) || [];

  const leftTokensRaw = tokenize(left || '');
  const rightTokensRaw = tokenize(right || '');

  const leftTokens: DiffToken[] = [];
  const rightTokens: DiffToken[] = [];

  let i = 0;
  let j = 0;

  while (i < leftTokensRaw.length || j < rightTokensRaw.length) {
    const l = leftTokensRaw[i] || '';
    const r = rightTokensRaw[j] || '';

    if (l === r) {
      leftTokens.push(makeToken('unchanged', l));
      rightTokens.push(makeToken('unchanged', r));
      i++;
      j++;
    } else {
      // Token mismatch → mark removed/added
      if (l) leftTokens.push(makeToken('removed', l));
      if (r) rightTokens.push(makeToken('added', r));
      i++;
      j++;
    }
  }

  const hasChanges = leftTokens.some(t => t.type !== 'unchanged') || rightTokens.some(t => t.type !== 'unchanged');

  return { leftTokens, rightTokens, hasChanges };
}



/**
 * Calculate word-level diff for a pair
 * Highlights only changed tokens (like InvocationID, DP_ID, testEnvironmentIds)
 */
export function calculatePairDiff(pair: AlignedLogPair): { leftDiff: LineDiff; rightDiff: LineDiff } {
  const leftMsg = pair.failed?.cleanLogMessage || '';
  const rightMsg = pair.successful?.cleanLogMessage || '';

  if (pair.isMissing === 'left') {
  return {
    leftDiff: { tokens: [], hasChanges: false },
    rightDiff: {
      tokens: [makeToken('unchanged', rightMsg)],
      hasChanges: false,
    },
  };
}

if (pair.isMissing === 'right') {
  return {
    leftDiff: {
      tokens: [makeToken('unchanged', leftMsg)],
      hasChanges: false,
    },
    rightDiff: { tokens: [], hasChanges: false },
  };
}

  // Both present - fine-grained token diff
  const { leftTokens, rightTokens, hasChanges } = calculateWordDiff(leftMsg, rightMsg);

  return {
    leftDiff: { tokens: leftTokens, hasChanges },
    rightDiff: { tokens: rightTokens, hasChanges },
  };
}

export default {
  alignLogs,
  calculateWordDiff,
  calculatePairDiff,
};
