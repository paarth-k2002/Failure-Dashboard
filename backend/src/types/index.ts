export interface LogEntry {
  id: number;
  timeStamp: string;
  logLevel: string;
  message: string;
  cleanLogMessage?: string; // Optional field for cleaned message
  logClass: string;
  testcaseId: string;
  jenkinsServer: string;
  threadName: string;
  lineNumber: number;
}

export interface ELKResponse {
  rawResponse: {
    hits: {
      hits: Array<{
        _source: {
          "log.timestamp": string;
          "log.level": string;
          message: string;
          "log.class": string;
          "test.trace.run_id": string;
          host?: {
            name?: string;
          };
          "log.thread": string;
          "log.offset": number;
        };
      }>;
    };
  };
}

export interface ELKRequestBody {
  params: {
    index: string;
    size: number;
    sort: Array<{ [key: string]: string }>;
    query: {
      bool: {
        must: Array<any>;
      };
    };
  };
}

export interface StartedTestcaseInfo {
  testcaseName: string;
  sourceSystemName: string;
  sourcePropertyName: string;
  targetSystemName: string;
  targetPropertyName: string;
  rawLine?: string;
}