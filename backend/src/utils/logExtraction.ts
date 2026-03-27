import { LogEntry } from "../types";

export interface StartedTestcaseInfo {
  testcaseName: string;
  sourceSystemName: string;
  sourcePropertyName: string;
  targetSystemName: string;
  targetPropertyName: string;
  rawLine: string;
}

/**
 * Scan logs in order and find the first line containing "Started testcase --->>"
 * Extract required fields and return them. Throws an Error with .status when
 * extraction fails.
 */
export function extractStartedTestcaseInfo(logs: LogEntry[]): StartedTestcaseInfo {
  if (!logs || logs.length === 0) {
    const e: any = new Error("No logs available for extraction");
    e.status = 404;
    throw e;
  }

  for (const entry of logs) {
    const msg = entry.message || "";
    if (msg.includes("Started testcase --->>")) {
      const raw = msg;

      // testcaseName from [M:TestReconcile.testRecoWithComment]
      const mMatch = raw.match(/\[M:([^\]]+)\]/);
      const testcaseName = mMatch ? mMatch[1].trim() : undefined;

      // Source System: {value}
      const sourceSystemMatch = raw.match(/Source System:\s*([^,\]\"]+)/i);
      const sourcePropMatch = raw.match(/Source Property:\s*([^,\]\"]+)/i);
      const targetSystemMatch = raw.match(/Target System:\s*([^,\]\"]+)/i);
      const targetPropMatch = raw.match(/Target Property:\s*([^,\]\"]+)/i);

      if (!testcaseName || !sourceSystemMatch || !sourcePropMatch || !targetSystemMatch || !targetPropMatch) {
        const e: any = new Error("Failed to extract required fields from Started testcase line");
        e.status = 422;
        throw e;
      }

      return {
        testcaseName: testcaseName,
        sourceSystemName: sourceSystemMatch[1].trim(),
        sourcePropertyName: sourcePropMatch[1].trim(),
        targetSystemName: targetSystemMatch[1].trim(),
        targetPropertyName: targetPropMatch[1].trim(),
        rawLine: raw,
      };
    }
  }

  const err: any = new Error('Started testcase --->> line not found in logs');
  err.status = 404;
  throw err;
}

export default extractStartedTestcaseInfo;
