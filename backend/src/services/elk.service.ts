import axios, { AxiosInstance } from "axios";
import NodeCache from "node-cache";
import { elkConfig } from "../config/elk.config";
import { ELKRequestBody, ELKResponse, LogEntry } from "../types";

class ELKService {
  private elkClient: AxiosInstance;
  private cache: NodeCache;

  constructor() {
    this.elkClient = axios.create({
      baseURL: elkConfig.url,
      headers: {
        "Content-Type": "application/json",
        "kbn-xsrf": "true",
      },
      auth: {
        username: elkConfig.username,
        password: elkConfig.password,
      },
      timeout: 60000,
    });

    this.cache = new NodeCache({
      stdTTL: 600,
      checkperiod: 60,
      useClones: false,
      maxKeys: 1000,
    });

    this.setupCacheMonitoring();
  }

  async fetchLogs(
    testcaseId: string,
    forceRefresh: boolean = false
  ): Promise<LogEntry[]> {
    const cacheKey = `logs:${testcaseId}`;

    // Check cache first
    if (!forceRefresh) {
      const cachedLogs = this.cache.get<LogEntry[]>(cacheKey);
      if (cachedLogs) {
        console.log(`✅ Cache HIT for testcase: ${testcaseId}`);
        return cachedLogs;
      }
      console.log(`❌ Cache MISS for testcase: ${testcaseId}`);
    } else {
      console.log(`🔄 Force refresh for testcase: ${testcaseId}`);
      this.cache.del(cacheKey);
    }

    try {
      console.log(`🔍 Fetching logs from ELK for testcase: ${testcaseId}`);

      const allLogs = await this.fetchAllLogsWithSearchAfter(testcaseId);

      // Store in cache
      this.cache.set(cacheKey, allLogs);
      console.log(`💾 Cached ${allLogs.length} logs for testcase: ${testcaseId}`);

      return allLogs;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ELK API Error:", {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw new Error(`Failed to fetch logs from ELK: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch all logs using search_after API
   * This bypasses the 10,000 record limit of from+size pagination
   */
  private async fetchAllLogsWithSearchAfter(
    testcaseId: string
  ): Promise<LogEntry[]> {
    const batchSize = 5000;
    let allHits: any[] = [];
    let searchAfter: any[] | undefined;
    let batchNumber = 1;
    let totalRecords = 0;

    while (true) {
      console.log(`📄 Batch ${batchNumber}: Fetching up to ${batchSize} logs...`);

      const requestBody: any = {
        params: {
          index: elkConfig.index,
          size: batchSize,
          sort: [
            { "@timestamp": "asc" },
            { "log.offset": "asc" },
          ],
          query: {
            bool: {
              must: [
                { term: { "test.trace.run_id": testcaseId } },
                {
                  query_string: {
                    query: "log.file.path:(*UILog.log* OR *test*)",
                  },
                },
              ],
            },
          },
        },
      };

      // Add search_after for subsequent requests
      if (searchAfter) {
        requestBody.params.search_after = searchAfter;
      }

      const response = await this.elkClient.post<any>("", requestBody);

      // Get total count from first request
      if (batchNumber === 1) {
        totalRecords = response.data?.rawResponse?.hits?.total || 0;
        console.log(`📊 Total logs available: ${totalRecords}`);
      }

      const hits = response.data?.rawResponse?.hits?.hits || [];

      if (hits.length === 0) {
        console.log(`✅ No more logs to fetch. Total retrieved: ${allHits.length}`);
        break;
      }

      allHits.push(...hits);
      console.log(
        `✅ Batch ${batchNumber}: Retrieved ${hits.length} logs (Total so far: ${allHits.length}/${totalRecords})`
      );

      // If we got fewer results than batchSize, we're done
      if (hits.length < batchSize) {
        console.log(`🎉 All logs retrieved: ${allHits.length}/${totalRecords}`);
        break;
      }

      // Get the sort values from the last hit for next search_after
      const lastHit = hits[hits.length - 1];
      searchAfter = lastHit.sort;

      if (!searchAfter) {
        console.warn(
          `⚠️ No sort values found in response. Cannot continue pagination.`
        );
        break;
      }

      console.log(`🔄 Next search_after: ${JSON.stringify(searchAfter)}`);

      batchNumber++;

      // Safety limit to prevent infinite loops
      if (batchNumber > 100) {
        console.warn(
          `⚠️ Reached maximum batch limit (100 batches = ~500,000 records). Stopping.`
        );
        break;
      }
    }

    console.log(`🎉 Total logs fetched: ${allHits.length}`);
    return this.transformLogsToEntries(allHits, testcaseId);
  }

  private transformLogsToEntries(hits: any[], testcaseId: string): LogEntry[] {
    let counter = 1;

    return hits.map((hit) => {
      const src = hit._source;

      const log: LogEntry = {
        id: counter,
        timeStamp: src["log.timestamp"],
        logLevel: src["log.level"],
        message: src["message"] || src["log.message"],
        cleanLogMessage: src["log.message"],
        logClass: src["log.class"],
        testcaseId,
        jenkinsServer: src?.host?.name ?? "UNKNOWN",
        threadName: src["log.thread"],
        lineNumber: counter,
      };

      counter++;
      return log;
    });
  }

  // Cache management methods
  clearCache(testcaseId?: string): boolean {
    if (testcaseId) {
      const cacheKey = `logs:${testcaseId}`;
      return this.cache.del(cacheKey) > 0;
    }
    this.cache.flushAll();
    return true;
  }

  getCacheStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      ksize: this.cache.getStats().ksize,
      vsize: this.cache.getStats().vsize,
    };
  }

  private setupCacheMonitoring() {
    setInterval(() => {
      const stats = this.getCacheStats();
      console.log("📊 Cache Statistics:", stats);
    }, 5 * 60 * 1000);
  }
}

export default new ELKService();