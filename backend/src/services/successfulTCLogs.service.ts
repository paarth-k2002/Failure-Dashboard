import elkService from "./elk.service";
import dbService from "./db.service";
import { extractStartedTestcaseInfo } from "../utils/logExtraction";
import { LogEntry } from "../types";

class SuccessfulTCLogsService {
  /**
   * Given an original testcaseId, find the 'Started testcase' line in its logs,
   * extract parameters, query DB for latest passing testcaseId, then fetch logs
   * for that testcaseId and return them.
   */
  async getSuccessfulTCLogs(originalTestcaseId: string): Promise<LogEntry[]> {
    // 1. Fetch logs for original testcaseId (prefer cache)
    const originalLogs = await elkService.fetchLogs(originalTestcaseId);

    if (!originalLogs || originalLogs.length === 0) {
      const e: any = new Error("No logs found for the provided testcaseId");
      e.status = 404;
      throw e;
    }

    // 2. Extract Started testcase info
    const info = extractStartedTestcaseInfo(originalLogs);

    // 3. Query DB for latest passing testcaseId matching extracted params
    const foundTestcaseId = await dbService.getLatestPassingTestcaseId({
      testcaseName: info.testcaseName,
      sourceSystemName: info.sourceSystemName,
      sourcePropertyName: info.sourcePropertyName,
      targetSystemName: info.targetSystemName,
      targetPropertyName: info.targetPropertyName,
    });

    if (!foundTestcaseId) {
      const e: any = new Error("No matching passing testcase found in database");
      e.status = 404;
      throw e;
    }

    // 4. Fetch logs for the found testcaseId
    const finalLogs = await elkService.fetchLogs(foundTestcaseId);

    if (!finalLogs || finalLogs.length === 0) {
      const e: any = new Error("Logs not found for the matched testcaseId");
      e.status = 404;
      throw e;
    }

    return finalLogs;
  }
}

export default new SuccessfulTCLogsService();
