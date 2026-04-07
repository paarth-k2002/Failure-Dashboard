/**
 * Pass/Fail Comparison Page
 * Side-by-side comparison of failed vs successful testcase logs
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { LogEntry, AlignedLogPair, LineDiff } from '@/types';
import comparisonService from '@/services/comparisonService';
import diffService from '@/services/diffService';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DiffResult {
  pair: AlignedLogPair;
  leftDiff: LineDiff;
  rightDiff: LineDiff;
}

const MAX_INITIAL_CHARS = 300; // Character limit for truncation

const PassFailComparison: React.FC = () => {
  const { testcaseId } = useParams<{ testcaseId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedLogs, setFailedLogs] = useState<LogEntry[]>([]);
  const [successfulLogs, setSuccessfulLogs] = useState<LogEntry[]>([]);
  const [diffs, setDiffs] = useState<DiffResult[]>([]);
  const [showRawView, setShowRawView] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  // Fetch logs on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!testcaseId) {
        setError('testcaseId is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await comparisonService.fetchLogsComparison(testcaseId);

        if (!result.failedLogs || result.failedLogs.length === 0) {
          setError('No failed logs found for this testcaseId');
          setLoading(false);
          return;
        }

        if (!result.successfulLogs || result.successfulLogs.length === 0) {
          setError('No successful logs found for this testcaseId');
          setLoading(false);
          return;
        }

        setFailedLogs(result.failedLogs);
        setSuccessfulLogs(result.successfulLogs);
        toast.success('Logs loaded successfully');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch logs';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [testcaseId]);

  // Calculate diffs when logs change
  useEffect(() => {
    if (failedLogs.length === 0 || successfulLogs.length === 0) return;

    try {
      const aligned = diffService.alignLogs(failedLogs, successfulLogs);
      const diffs: DiffResult[] = aligned.map((pair) => {
        const { leftDiff, rightDiff } = diffService.calculatePairDiff(pair);
        return { pair, leftDiff, rightDiff };
      });

      setDiffs(diffs);
    } catch (err) {
      console.error('Error calculating diffs:', err);
    }
  }, [failedLogs, successfulLogs]);

  // Helper to generate unique key for a log message (shared between left and right)
  const getLogKey = (pair: AlignedLogPair): string => {
    return `${pair.failed?.lineNumber ?? 'x'}-${pair.successful?.lineNumber ?? 'y'}`;
  };

  // Helper to check if a message exceeds character limit
  const shouldTruncate = (message: string): boolean => {
    return message.length > MAX_INITIAL_CHARS;
  };

  // Helper to truncate message to visible character limit
  const truncateMessage = (message: string): string => {
    if (message.length > MAX_INITIAL_CHARS) {
      return message.substring(0, MAX_INITIAL_CHARS) + '...';
    }
    return message;
  };

  const renderDiffTokens = (
  tokens: any[],
  normalize: boolean = false,
  isExtraLine: boolean = false
) => {
    return tokens.map((token, tidx) => {
      // Normalize whitespace if needed (remove newlines, collapse spaces) - only when expanded
      const content = token.content;

      return (
        <span
          key={tidx}
          className={cn({
  'bg-yellow-500/30 text-yellow-700 dark:text-yellow-400':
    token.type === 'modified' && !isExtraLine,
  'bg-red-500/30 text-red-600 dark:text-red-400':
    token.type === 'removed' && !isExtraLine,
  'bg-green-500/30 text-green-600 dark:text-green-400':
    token.type === 'added' && !isExtraLine,
})}
        >
          {content}
        </span>
      );
    });
  };

  /**
   * RENDER LOG CONTENT WITH SYNCHRONIZED EXPAND/COLLAPSE
   *
   * SYNCHRONIZATION STRATEGY:
   * ========================
   * Both LEFT and RIGHT panels use IDENTICAL logic to ensure they stay in sync:
   *
   * 1. SHARED EXPANSION KEY:
   *    - Both left and right panels receive the SAME diffIndex parameter
   *    - Both generate the SAME key: `row-${diffIndex}`
   *    - When button is clicked on either side, this key is added/removed from expandedMessages Set
   *    - Since both panels check the same key, they get the same isExpanded value
   *
   * 2. SYNCHRONIZED TRUNCATION DECISION:
   *    - Both panels calculate button visibility using BOTH messages (failedMsg + successMsg)
   *    - Decision: `Math.max(failedMsg.length, successMsg.length) > MAX_INITIAL_CHARS`
   *    - If EITHER message is long, BOTH panels show the button
   *    - This prevents one side from showing button when the other doesn't
   *
   * 3. IDENTICAL TOKEN RENDERING:
   *    - When isExpanded changes, ALL tokens are shown (both sides use same diff object)
   *    - When collapsed, tokens are truncated at the SAME character count (300 chars)
   *    - CSS classes respond to isExpanded state:
   *      * Expanded:  whitespace-normal (continuous flow)
   *      * Collapsed: whitespace-pre-wrap (preserved formatting)
   *
   * RESULT: When user clicks expand on EITHER side, BOTH sides expand with same CSS styling
   */
  const renderLogContent = (log: LogEntry | null, diff: LineDiff, rowKey: string, failedLog: LogEntry | null, successLog: LogEntry | null) => {
    if (!log) {
      return (   
        <div className="flex flex-col gap-1 w-full px-4 py-2 font-mono text-sm opacity-50">

          <div className="flex w-full gap-3">
            {/* Empty line number */}
            <div className="w-12 text-right flex-shrink-0">
              <span className="text-xs text-muted-foreground">-</span>
            </div>

            {/* Placeholder */}
            <div className="flex-1 min-w-0 italic text-muted-foreground">
              (no log)
            </div>
          </div>

        </div>
      );

    }

    // ========== SYNCHRONIZATION: Shared Expansion Key ==========
    const expansionKey = rowKey; // Same for both left and right
    const isExpanded = !!expandedMessages[expansionKey]; // Both read same key

    // ========== SYNCHRONIZATION: Shared Truncation Decision ==========
    const failedMsg = showRawView ? failedLog?.message : failedLog?.cleanLogMessage;
    const successMsg = showRawView ? successLog?.message : successLog?.cleanLogMessage;
    const maxMsgLength = Math.max(failedMsg?.length || 0, successMsg?.length || 0);

    // ✅ CORRECT diff detection
    const hasRealDiff =
      diff?.tokens?.some(t => t.type === 'added' || t.type === 'removed' || t.type === 'modified') ?? false;

    const isLongText = maxMsgLength > MAX_INITIAL_CHARS;

    // ✅ Show button for every aligned row (diff/unchanged/long/short)
    // This ensures same rows also have consistent collapse/expand behaviour.
    const shouldShowButton = isLongText;

    // Get the actual message for this panel
    const message = showRawView ? log.message : log.cleanLogMessage;
    const hasDiffTokens = diff && diff.tokens.length > 0;

    const isExtraLine = !failedLog || !successLog;

    // ========== BUILD DISPLAY CONTENT ==========
    let displayTokens: any[] = [];
    let shouldShowDiffTokens = false;

    if (hasDiffTokens) {
  shouldShowDiffTokens = true;

  let charCount = 0;

  for (const token of diff.tokens) {
    if (!isExpanded && charCount >= MAX_INITIAL_CHARS) break;

    const remaining = MAX_INITIAL_CHARS - charCount;

    if (!isExpanded && token.content.length > remaining) {
      displayTokens.push({
        ...token,
        content: token.content.substring(0, remaining),
      });
      break;
    }

    displayTokens.push(token);
    charCount += token.content.length;
  }
}


    return (
      <div className="flex flex-col gap-1 w-full overflow-x-hidden px-4 py-2 font-mono text-sm">

        {/* TOP ROW: line number + content */}
        <div className="flex w-full gap-3">

          {/* Line number */}
          <div className="w-12 text-right flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {log.lineNumber}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-x-hidden">
            {shouldShowDiffTokens ? (
  <div className="w-full whitespace-pre-wrap break-all text-foreground">
    {renderDiffTokens(displayTokens, isExpanded, isExtraLine)}
  </div>
) : (
  <div className="whitespace-pre-wrap break-all text-foreground">
    {isExpanded ? message : truncateMessage(message)}
  </div>
)}
          </div>
        </div>

        {/* BOTTOM ROW: BUTTON */}
        {shouldShowButton && (
          <div className="pl-12">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-7 border border-border"
              onClick={() => {
                setExpandedMessages(prev => ({
                  ...prev,
                  [expansionKey]: !prev[expansionKey]
                }));
              }}

            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                 Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                 Expand
                </>
              )}
            </Button>
          </div>
        )}

      </div>
    );
  };

  const renderRows = () => {
    return diffs.map((diff, idx) => {
      const rowKey = `row-${idx}`;

      return (
        <div key={rowKey} className="grid grid-cols-2 border-b border-border">

          {/* LEFT PANEL */}
          <div
            className={cn(
              "border-r border-border border-l-4",
              {
                "border-l-red-500": diff.pair.failed,   // normal / left exists
                "border-l-transparent": !diff.pair.failed // missing
              }
            )}
          >
            {renderLogContent(
              diff.pair.failed,
              diff.leftDiff,
              rowKey,
              diff.pair.failed,
              diff.pair.successful
            )}
          </div>

          {/* RIGHT PANEL */}
          <div
            className={cn(
              "border-l-4",
              {
                "border-l-green-500": diff.pair.successful,
                "border-l-transparent": !diff.pair.successful
              }
            )}
          >
            {renderLogContent(
              diff.pair.successful,
              diff.rightDiff,
              rowKey,
              diff.pair.failed,
              diff.pair.successful
            )}
          </div>

        </div>
      );
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-lg text-foreground">Loading comparison data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-full max-w-md space-y-4 p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <h2 className="text-lg font-semibold">Error</h2>
          </div>
          <p className="text-foreground">{error}</p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (diffs.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <p className="text-lg text-foreground">No logs to compare</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-background">
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pass/Fail Comparison</h1>
          <p className="text-sm text-muted-foreground">
            TestcaseId: <span className="font-mono text-primary">{testcaseId}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Raw view toggle */}
          <Button
            variant={showRawView ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowRawView(!showRawView)}
          >
            {showRawView ? 'Clean View' : 'Raw View'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Failed Logs</p>
          <p className="text-2xl font-bold text-red-500">{failedLogs.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Successful Logs</p>
          <p className="text-2xl font-bold text-green-500">{successfulLogs.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Aligned</p>
          <p className="text-2xl font-bold text-primary">{diffs.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Changed Lines</p>
          <p className="text-2xl font-bold text-yellow-500">
            {diffs.filter((d) => d.leftDiff.hasChanges || d.rightDiff.hasChanges).length}
          </p>
        </div>
      </div>

      {/* Comparison panels - Content wraps within container boundaries */}
      <div className="flex flex-col border border-border rounded-lg bg-card">

        {/* Header Row */}
        <div className="grid grid-cols-2 border-b border-border font-semibold text-sm">
          <div className="px-4 py-3 bg-red-500/10 text-red-600 dark:text-red-400 border-r border-border">
            Failed Testcase ({failedLogs.length})
          </div>
          <div className="px-4 py-3 bg-green-500/10 text-green-600 dark:text-green-400">
            Successful Testcase ({successfulLogs.length})
          </div>
        </div>

        {/* Diff Rows */}
        {renderRows()}

      </div>

    </div>
  );
};

export default PassFailComparison;
