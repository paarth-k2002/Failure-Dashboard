import axios from "axios";
import { LogEntry } from "@/types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// In-memory cache
const logsCache = new Map<string, {
  data: LogEntry[];
  timestamp: number;
}>();

// Cache duration: 5 minutes (adjust as needed)
const CACHE_DURATION = 10 * 60 * 1000;

export const fetchLogsFromELK = async (
  testcaseId: string,
  forceRefresh: boolean = false
): Promise<LogEntry[]> => {
  // Check cache first
  if (!forceRefresh && logsCache.has(testcaseId)) {
    const cached = logsCache.get(testcaseId)!;
    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
    
    if (!isExpired) {
      console.log(`📦 Using cached logs for testcase: ${testcaseId}`);
      return cached.data;
    }
    
    // Remove expired cache
    logsCache.delete(testcaseId);
  }

  // Fetch fresh data
  try {
    console.log(`🔄 Fetching logs for testcase: ${testcaseId}`);
    const response = await apiClient.get(`/api/logs/${testcaseId}`);
    
    if (response.data.success) {
      const logs = response.data.data;
      
      // Store in cache
      logsCache.set(testcaseId, {
        data: logs,
        timestamp: Date.now(),
      });
      
      return logs;
    }
    
    throw new Error("Failed to fetch logs");
  } catch (error) {
    console.error(`Failed to fetch logs for testcase ${testcaseId}:`, error);
    throw error;
  }
};

// Utility function to clear cache
export const clearLogsCache = (testcaseId?: string) => {
  if (testcaseId) {
    logsCache.delete(testcaseId);
    console.log(`🗑️ Cleared cache for testcase: ${testcaseId}`);
  } else {
    logsCache.clear();
    console.log(`🗑️ Cleared all logs cache`);
  }
};

// Utility function to get cache stats
export const getCacheStats = () => {
  return {
    size: logsCache.size,
    entries: Array.from(logsCache.keys()),
  };
};