import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface PingOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  expectedStatusCode?: number;
}

export interface PingResult {
  url: string;
  status: 'UP' | 'DOWN';
  statusCode: number | null;
  latencyMs: number;
  timestamp: string;
  isExpectedStatus: boolean;
  errorMessage: string | null;
  errorCode: string | null;
  responseSize: number | null;
}

export async function pingEndpoint(options: PingOptions): Promise<PingResult> {
  const {
    url,
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 10000,
    expectedStatusCode = 200,
  } = options;

  const startTime = process.hrtime.bigint();
  const timestamp = new Date().toISOString();

  const config: AxiosRequestConfig = {
    url,
    method,
    headers: {
      'User-Agent': 'PulseGuard-Monitor/1.0',
      ...headers,
    },
    data: body,
    timeout: timeoutMs,
    maxRedirects: 5,
    validateStatus: () => true,
  };

  try {
    const response: AxiosResponse = await axios(config);
    const endTime = process.hrtime.bigint();
    const latencyMs = Number((endTime - startTime) / 1000000n);

    const statusCode = response.status;
    const isExpectedStatus = statusCode === expectedStatusCode;
    const isUp = statusCode >= 200 && statusCode < 400 && isExpectedStatus;

    let responseSize: number | null = null;
    if (response.headers['content-length']) {
      responseSize = parseInt(response.headers['content-length'], 10);
    } else if (response.data) {
      responseSize = Buffer.byteLength(
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data)
      );
    }

    return {
      url,
      status: isUp ? 'UP' : 'DOWN',
      statusCode,
      latencyMs,
      timestamp,
      isExpectedStatus,
      errorMessage: isUp ? null : `Status code: ${statusCode} (expected ${expectedStatusCode})`,
      errorCode: null,
      responseSize,
    };
  } catch (err: unknown) {
    const endTime = process.hrtime.bigint();
    const latencyMs = Number((endTime - startTime) / 1000000n);

    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const code = axiosErr.code || 'UNKNOWN_ERROR';
      let message = axiosErr.message;

      if (code === 'ECONNABORTED' || message.includes('timeout')) {
        message = `Request timed out after ${timeoutMs}ms`;
      } else if (code === 'ENOTFOUND') {
        message = 'Host not found / DNS lookup failed';
      } else if (code === 'ECONNREFUSED') {
        message = 'Connection refused by destination host';
      } else if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        message = 'SSL/TLS certificate verification failed';
      }

      return {
        url,
        status: 'DOWN',
        statusCode: null,
        latencyMs,
        timestamp,
        isExpectedStatus: false,
        errorMessage: message,
        errorCode: code,
        responseSize: null,
      };
    }

    const standardErr = err instanceof Error ? err : new Error(String(err));
    return {
      url,
      status: 'DOWN',
      statusCode: null,
      latencyMs,
      timestamp,
      isExpectedStatus: false,
      errorMessage: standardErr.message || 'Unknown network error',
      errorCode: 'INTERNAL_ERROR',
      responseSize: null,
    };
  }
}

export class HealthCheckerService {
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 10000) {
    this.defaultTimeout = defaultTimeout;
  }

  public async check(
    url: string,
    method: PingOptions['method'] = 'GET',
    timeoutMs: number = this.defaultTimeout,
    expectedStatus: number = 200,
    headers?: Record<string, string>,
    body?: unknown
  ): Promise<PingResult> {
    return pingEndpoint({
      url,
      method,
      timeoutMs,
      expectedStatusCode: expectedStatus,
      headers,
      body,
    });
  }

  public async checkMany(targets: PingOptions[]): Promise<PingResult[]> {
    return Promise.all(targets.map((target) => pingEndpoint(target)));
  }
}

export const checkerService = new HealthCheckerService();