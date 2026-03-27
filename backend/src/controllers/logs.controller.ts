import { Request, Response, NextFunction } from "express";
import elkService from "../services/elk.service";
import successfulTCLogsService from "../services/successfulTCLogs.service";

export class LogsController {
  async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { testcaseId } = req.params;

      if (!testcaseId) {
        return res.status(400).json({
          success: false,
          message: "testcaseId is required",
        });
      }

      const logs = await elkService.fetchLogs(testcaseId);

      return res.status(200).json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSuccessfulTCLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { testcaseId } = req.params;

      if (!testcaseId) {
        return res.status(400).json({ success: false, message: "testcaseId is required" });
      }

      const logs = await successfulTCLogsService.getSuccessfulTCLogs(testcaseId);

      return res.status(200).json({ success: true, data: logs, count: logs.length });
    } catch (error) {
      next(error);
    }
  }
}

export default new LogsController();