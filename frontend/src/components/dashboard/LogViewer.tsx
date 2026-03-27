/**
 * LogViewer Component
 * Reusable virtualized log viewer with diff highlighting and metadata
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { LogEntry, LineDiff, DiffToken } from '@/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Copy, Code } from 'lucide-react';
import { toast } from 'sonner';

interface LogViewerProps {
  logs: LogEntry[];
  diff?: LineDiff;
  side: 'left' | 'right';
  title: string;
  onScroll?: (scrollTop: number) => void;
  showRawView?: boolean;
  containerHeight?: number;
  lineHeight?: number;
}

/**
 * Render a single diff token with appropriate styling
 */
const DiffToken: React.FC<{ token: DiffToken }> = ({ token }) => {
  const baseClasses = 'font-mono';

  switch (token.type) {
    case 'added':
      return (
        <span className={cn(baseClasses, 'bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-600 dark:text-green-400')}>
          {token.content}
        </span>
      );
    case 'removed':
      return (
        <span className={cn(baseClasses, 'bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-600 dark:text-red-400 line-through')}>
          {token.content}
        </span>
      );
    case 'modified':
      return (
        <span className={cn(baseClasses, 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 text-yellow-700 dark:text-yellow-400')}>
          {token.content}
        </span>
      );
    case 'unchanged':
    default:
      return <span className={baseClasses}>{token.content}</span>;
  }
};

/**
 * Single log line renderer
 */
const LogLine: React.FC<{
  log: LogEntry | null;
  diff?: LineDiff;
  showRaw?: boolean;
  isMissing?: 'left' | 'right';
}> = ({ log, diff, showRaw, isMissing }) => {
  if (!log) {
    return (
      <div className="flex items-center h-12 px-4 bg-muted/30 border-l-4 border-muted">
        <span className="text-xs text-muted-foreground">[ missing ]</span>
      </div>
    );
  }

  const message = showRaw ? log.message : log.cleanLogMessage;
  const borderColor =
    isMissing === 'left'
      ? 'border-l-green-500'
      : isMissing === 'right'
        ? 'border-l-red-500'
        : 'border-l-primary';

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div className={cn('flex items-start gap-3 px-4 py-2 border-l-4 hover:bg-muted/40 transition-colors', borderColor)}>
          <div className="flex-shrink-0 w-12 text-right">
            <span className="text-xs font-mono text-muted-foreground">
              {log.lineNumber}
            </span>
          </div>
          <div className="flex-1 min-w-0 font-mono text-sm break-words whitespace-pre-wrap">
            {diff && diff.tokens.length > 0 ? (
              <div className="flex flex-wrap gap-0">
                {diff.tokens.map((token, idx) => (
                  <DiffToken key={idx} token={token} />
                ))}
              </div>
            ) : (
              <span className="text-foreground">{message}</span>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <div className="text-xs space-y-1">
          <p>
            <strong>Time:</strong> {log.timeStamp}
          </p>
          <p>
            <strong>Level:</strong> {log.logLevel}
          </p>
          <p>
            <strong>Thread:</strong> {log.threadName || 'N/A'}
          </p>
          <p>
            <strong>Class:</strong> {log.logClass}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Main LogViewer Component
 */
export const LogViewer = React.forwardRef<HTMLDivElement, LogViewerProps>(
  (
    {
      logs,
      diff,
      side,
      title,
      onScroll,
      showRawView = false,
      containerHeight = 600,
      lineHeight = 48,
    },
    ref
  ) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle scroll events
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        onScroll?.(target.scrollTop);
      },
      [onScroll]
    );

    // Copy all logs to clipboard
    const handleCopyAll = useCallback(() => {
      const text = logs
        .map(
          (log) =>
            `[${log.lineNumber}] ${log.timeStamp} ${log.logLevel} - ${
              showRawView ? log.message : log.cleanLogMessage
            }`
        )
        .join('\n');

      navigator.clipboard.writeText(text).then(() => {
        toast.success('Copied to clipboard');
      });
    }, [logs, showRawView]);

    const visibleLogsCount = Math.ceil(containerHeight / lineHeight) + 2; // Add buffer

    return (
      <div
        ref={containerRef}
        className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                side === 'left' ? 'bg-red-500' : 'bg-green-500'
              )}
            />
            {title}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyAll}
            className="h-8 w-8 p-0"
            title="Copy all logs"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {/* Log Container */}
        <div
          ref={ref || scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ height: containerHeight }}
          onScroll={handleScroll}
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No logs available</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {logs.map((log, idx) => (
                <LogLine
                  key={`${log.testcaseId}-${log.lineNumber}-${idx}`}
                  log={log}
                  diff={diff}
                  showRaw={showRawView}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
          {logs.length} logs
        </div>
      </div>
    );
  }
);

LogViewer.displayName = 'LogViewer';

export default LogViewer;
