/**
 * Comparison Service
 * Fetches and compares failed vs successful testcase logs
 */

import axios from 'axios';
import { LogEntry } from '@/types';
import { APP_CONFIG } from '@/config/appConfig';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ComparisonResponse {
  success: boolean;
  data: LogEntry[];
  count?: number;
  message?: string;
}

interface ComparisonResult {
  failedLogs: LogEntry[];
  successfulLogs: LogEntry[];
}

class ComparisonService {
  /**
   * Fetch both failed and successful logs in parallel
   */
  async fetchLogsComparison(testcaseId: string): Promise<ComparisonResult> {
    if (!testcaseId) {
      throw new Error('testcaseId is required');
    }

    try {
      // Fetch both in parallel
      const [failedRes, successfulRes] = await Promise.all([
        axios.get<ComparisonResponse>(
          `${API_BASE}/api/logs/${testcaseId}`,
          { timeout: 60000 }
        ),
        axios.get<ComparisonResponse>(
          `${API_BASE}/api/logs/${testcaseId}/successfulTCLogs`,
          { timeout: 60000 }
        ),
      ]);

      if (!failedRes.data.success) {
        throw new Error(failedRes.data.message || 'Failed to fetch failed logs');
      }

      if (!successfulRes.data.success) {
        throw new Error(successfulRes.data.message || 'Failed to fetch successful logs');
      }

      return {
        failedLogs: failedRes.data.data || [],
        successfulLogs: successfulRes.data.data || [],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to fetch comparison logs: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Fetch failed logs only
   */
  async fetchFailedLogs(testcaseId: string): Promise<LogEntry[]> {
    if (!testcaseId) {
      throw new Error('testcaseId is required');
    }

    try {
      const res = await axios.get<ComparisonResponse>(
        `${API_BASE}/api/logs/${testcaseId}`,
        { timeout: 60000 }
      );

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch logs');
      }

      return res.data.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch logs: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch successful logs only
   */
  async fetchSuccessfulLogs(testcaseId: string): Promise<LogEntry[]> {
    if (!testcaseId) {
      throw new Error('testcaseId is required');
    }

    try {
      const res = await axios.get<ComparisonResponse>(
        `${API_BASE}/api/logs/${testcaseId}/successfulTCLogs`,
        { timeout: 60000 }
      );

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch logs');
      }

      return res.data.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch logs: ${error.message}`);
      }
      throw error;
    }
  }
}

export default new ComparisonService();
