/**
 * Pass/Fail Comparison Page
 * Side-by-side comparison of failed vs successful testcase logs
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { LogEntry, AlignedLogPair, LineDiff } from '@/types';
import comparisonService from '@/services/comparisonService';
import diffService from '@/services/diffService';
import scrollSyncService, { ScrollMode } from '@/services/scrollSyncService';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [scrollMode, setScrollMode] = useState<ScrollMode>('sync');
  const [showRawView, setShowRawView] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const leftScrollContainerRef = useRef<HTMLDivElement>(null);
  const rightScrollContainerRef = useRef<HTMLDivElement>(null);

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
  useMemo(() => {
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

  // Handle scroll synchronization
  const handleLeftScroll = useCallback(() => {
    if (leftScrollContainerRef.current && rightScrollContainerRef.current) {
      scrollSyncService.handleLeftScroll(
        leftScrollContainerRef.current,
        rightScrollContainerRef.current,
        leftScrollContainerRef.current.scrollTop
      );
    }
  }, []);

  const handleRightScroll = useCallback(() => {
    if (leftScrollContainerRef.current && rightScrollContainerRef.current) {
      scrollSyncService.handleRightScroll(
        leftScrollContainerRef.current,
        rightScrollContainerRef.current,
        rightScrollContainerRef.current.scrollTop
      );
    }
  }, []);

  const handleScrollModeChange = (mode: ScrollMode) => {
    setScrollMode(mode);
    scrollSyncService.setMode(mode);
  };

  // Helper to generate unique key for a log message
  const getLogKey = (diffIndex: number, side: 'left' | 'right'): string => {
    return `${diffIndex}-${side}`;
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

  const renderDiffTokens = (tokens: any[]) => {
    return tokens.map((token, tidx) => (
      <span
        key={tidx}
        className={cn('', {
          'bg-yellow-500/30 text-yellow-700 dark:text-yellow-400': token.type === 'modified',
          'bg-red-500/30 text-red-600 dark:text-red-400': token.type === 'removed',
          'bg-green-500/30 text-green-600 dark:text-green-400': token.type === 'added',
        })}
      >
        {token.content}
      </span>
    ));
  };

  const renderLogContent = (log: LogEntry | null, diff: LineDiff, diffIndex: number, side: 'left' | 'right') => {
    if (!log) return null;

    const logKey = getLogKey(diffIndex, side);
    const isExpanded = expandedMessages.has(logKey);
    const message = showRawView ? log.message : log.cleanLogMessage;
    const isTruncated = shouldTruncate(message);
    const displayMessage = isExpanded ? message : truncateMessage(message);
    const remainingChars = message.length - MAX_INITIAL_CHARS;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3 px-4 py-2 font-mono text-sm break-words whitespace-pre-wrap">
          <div className="flex-shrink-0 w-12 text-right">
            <span className="text-xs text-muted-foreground">{log.lineNumber}</span>
          </div>
          <div className="flex-1 min-w-0">
            {diff && diff.tokens.length > 0 && isExpanded ? (
              // Only show diff tokens when fully expanded
              <div className="flex flex-wrap gap-0">{renderDiffTokens(diff.tokens)}</div>
            ) : (
              // Show plain text when truncated or on initial view
              <span className="text-foreground">{displayMessage}</span>
            )}
          </div>
        </div>
        {isTruncated && (
          <div className="px-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newSet = new Set(expandedMessages);
                if (newSet.has(logKey)) {
                  newSet.delete(logKey);
                } else {
                  newSet.add(logKey);
                }
                setExpandedMessages(newSet);
              }}
              className="gap-1 text-xs h-8"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Expand ({remainingChars} more characters)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
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
          {/* Scroll mode selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Scroll:</label>
            <Select value={scrollMode} onValueChange={(v) => handleScrollModeChange(v as ScrollMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sync">Synchronized</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
                <SelectItem value="unified">Unified</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

      {/* Comparison panels */}
      {scrollMode === 'unified' ? (
        // Unified scroll mode - single scrollable container with both columns
        <div className="flex-1 overflow-y-auto border border-border rounded-lg bg-card">
          <div className="grid grid-cols-2 gap-0">
            {/* Left column header */}
            <div className="sticky top-0 z-20 px-4 py-3 bg-red-500/10 border-r border-b border-border">
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
                Failed Testcase
              </h2>
            </div>
            {/* Right column header */}
            <div className="sticky top-0 z-20 px-4 py-3 bg-green-500/10 border-b border-border">
              <h2 className="text-sm font-semibold text-green-600 dark:text-green-400">
                Successful Testcase
              </h2>
            </div>

            {/* Log rows */}
            {diffs.map((diff, idx) => (
              <React.Fragment key={idx}>
                {/* Left log */}
                <div className="border-r border-b border-border hover:bg-muted/40 transition-colors border-l-4 border-l-red-500">
                  {renderLogContent(diff.pair.failed, diff.leftDiff, idx, 'left')}
                </div>

                {/* Right log */}
                <div className="border-b border-border hover:bg-muted/40 transition-colors border-l-4 border-l-green-500">
                  {renderLogContent(diff.pair.successful, diff.rightDiff, idx, 'right')}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        // Sync or Independent scroll mode - two separate scrollable panels
        <div className="flex-1 grid grid-cols-2 gap-4">
          {/* Left panel */}
          <div
            ref={leftScrollContainerRef}
            className="flex flex-col overflow-y-auto border border-border rounded-lg"
            onScroll={handleLeftScroll}
          >
            <div className="sticky top-0 z-10 px-4 py-3 bg-red-500/10 border-b border-border">
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
                Failed Testcase ({failedLogs.length})
              </h2>
            </div>
            <div className="flex-1">
              {diffs.map((diff, idx) => (
                <div 
                  key={idx} 
                  className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors border-l-4 border-l-red-500"
                >
                  {renderLogContent(diff.pair.failed, diff.leftDiff, idx, 'left')}
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 z-10 px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
              {failedLogs.length} logs
            </div>
          </div>

          {/* Right panel */}
          <div
            ref={rightScrollContainerRef}
            className="flex flex-col overflow-y-auto border border-border rounded-lg"
            onScroll={handleRightScroll}
          >
            <div className="sticky top-0 z-10 px-4 py-3 bg-green-500/10 border-b border-border">
              <h2 className="text-sm font-semibold text-green-600 dark:text-green-400">
                Successful Testcase ({successfulLogs.length})
              </h2>
            </div>
            <div className="flex-1">
              {diffs.map((diff, idx) => (
                <div 
                  key={idx} 
                  className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors border-l-4 border-l-green-500"
                >
                  {renderLogContent(diff.pair.successful, diff.rightDiff, idx, 'right')}
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 z-10 px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
              {successfulLogs.length} logs
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PassFailComparison;
