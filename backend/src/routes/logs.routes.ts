import { Router } from "express";
import logsController from "../controllers/logs.controller";

const router = Router();

// GET /api/logs/:testcaseId
router.get("/:testcaseId", logsController.getLogs);

// GET /api/logs/:testcaseId/successfulTCLogs
router.get("/:testcaseId/successfulTCLogs", logsController.getSuccessfulTCLogs);

export default router;