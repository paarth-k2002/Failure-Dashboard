/**
 * Diff Service
 * Handles line and word-level diff calculations for comparison
 */

import { LogEntry, LineDiff, DiffToken, AlignedLogPair } from '@/types';

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
      if (left[i - 1].cleanLogMessage === right[j - 1].cleanLogMessage) {
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
    if (left[i - 1].cleanLogMessage === right[j - 1].cleanLogMessage) {
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

/**
 * Align two arrays of logs using LCS
 * Returns pairs with null for missing entries on either side
 */
export function alignLogs(
  failedLogs: LogEntry[],
  successfulLogs: LogEntry[]
): AlignedLogPair[] {
  const matches = lcs(failedLogs, successfulLogs);
  const matchSet = new Set(matches.map((m) => `${m[0]},${m[1]}`));

  const result: AlignedLogPair[] = [];
  const usedRight = new Set<number>();

  let rightIdx = 0;

  for (let i = 0; i < failedLogs.length; i++) {
    const key = Array.from(matchSet).find((k) => k.startsWith(`${i},`));
    if (key) {
      const [, j] = key.split(',').map(Number);
      usedRight.add(j);

      // Add any skipped right entries before this match
      while (rightIdx < j) {
        result.push({
          failed: null,
          successful: successfulLogs[rightIdx],
          isMissing: 'left',
        });
        rightIdx++;
      }

      result.push({
        failed: failedLogs[i],
        successful: successfulLogs[j],
        isMissing: 'none',
      });
      rightIdx++;
    } else {
      result.push({
        failed: failedLogs[i],
        successful: null,
        isMissing: 'right',
      });
    }
  }

  // Add remaining right entries
  while (rightIdx < successfulLogs.length) {
    result.push({
      failed: null,
      successful: successfulLogs[rightIdx],
      isMissing: 'left',
    });
    rightIdx++;
  }

  return result;
}

/**
 * Simple word-level diff using greedy matching
 * Splits by word boundaries and highlights only differences
 */
export function calculateWordDiff(left: string, right: string): LineDiff {
  if (left === right) {
    return {
      tokens: [{ type: 'unchanged', content: left }],
      hasChanges: false,
    };
  }

  const leftWords = left.split(/(\s+)/);
  const rightWords = right.split(/(\s+)/);

  const tokens: DiffToken[] = [];
  let li = 0,
    ri = 0;

  while (li < leftWords.length || ri < rightWords.length) {
    const lw = leftWords[li] || '';
    const rw = rightWords[ri] || '';

    if (lw === rw) {
      tokens.push({ type: 'unchanged', content: lw });
      li++;
      ri++;
    } else if (!lw) {
      // Right has extra content
      tokens.push({ type: 'added', content: rw });
      ri++;
    } else if (!rw) {
      // Left has extra content
      tokens.push({ type: 'removed', content: lw });
      li++;
    } else {
      // Both are different - only mark as modified, no strikethrough
      tokens.push({ type: 'modified', content: lw });
      tokens.push({ type: 'modified', content: rw });
      li++;
      ri++;
    }
  }

  const hasChanges = tokens.some((t) => t.type !== 'unchanged');
  return { tokens, hasChanges };
}

/**
 * Calculate diff for aligned log pair
 */
export function calculatePairDiff(pair: AlignedLogPair): {
  leftDiff: LineDiff;
  rightDiff: LineDiff;
} {
  const leftMsg = pair.failed?.cleanLogMessage || '';
  const rightMsg = pair.successful?.cleanLogMessage || '';

  if (pair.isMissing === 'left') {
    // Right only - mark as added
    return {
      leftDiff: { tokens: [{ type: 'added', content: '' }], hasChanges: true },
      rightDiff: {
        tokens: [{ type: 'added', content: rightMsg }],
        hasChanges: true,
      },
    };
  }

  if (pair.isMissing === 'right') {
    // Left only - mark as removed
    return {
      leftDiff: { tokens: [{ type: 'removed', content: leftMsg }], hasChanges: true },
      rightDiff: {
        tokens: [{ type: 'removed', content: '' }],
        hasChanges: true,
      },
    };
  }

  // Both present - word-level diff
  const wordDiff = calculateWordDiff(leftMsg, rightMsg);
  return {
    leftDiff: wordDiff,
    rightDiff: wordDiff,
  };
}

export default {
  alignLogs,
  calculateWordDiff,
  calculatePairDiff,
};
