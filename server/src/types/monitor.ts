export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type MonitorStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED' | 'PENDING';

export type AlertChannelType = 'EMAIL' | 'SLACK' | 'DISCORD' | 'CUSTOM_WEBHOOK';

export interface KeyValueHeader {
  key: string;
  value: string;
}

export interface AlertChannelConfig {
  id: string;
  type: AlertChannelType;
  target: string;
  enabled: boolean;
}

export interface AlertConfig {
  id: string;
  monitorId: string;
  failureThreshold: number;
  recoveryThreshold: number;
  channels: AlertChannelConfig[];
  alertOnDegraded: boolean;
  maxLatencyMs: number;
  sendResolvedNotification: boolean;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  headers?: KeyValueHeader[];
  body?: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  expectedStatusCodes: number[];
  status: MonitorStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  uptimePercentage24h?: number;
  averageLatency24h?: number;
  alertConfig?: AlertConfig;
}

export interface CheckResult {
  id: string;
  monitorId: string;
  timestamp: string;
  statusCode: number | null;
  responseTimeMs: number;
  isSuccessful: boolean;
  errorMessage?: string;
  status: MonitorStatus;
  responseHeaders?: Record<string, string>;
  responseBodySnippet?: string;
}

export interface WebhookPayload {
  eventId: string;
  eventType: 'MONITOR_DOWN' | 'MONITOR_UP' | 'MONITOR_DEGRADED' | 'MANUAL_TEST';
  timestamp: string;
  monitor: {
    id: string;
    name: string;
    url: string;
    method: HttpMethod;
    status: MonitorStatus;
  };
  checkResult: {
    statusCode: number | null;
    responseTimeMs: number;
    timestamp: string;
    errorMessage?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface CreateMonitorDTO {
  name: string;
  url: string;
  method: HttpMethod;
  headers?: KeyValueHeader[];
  body?: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  expectedStatusCodes: number[];
  alertConfig?: Omit<AlertConfig, 'id' | 'monitorId'>;
}

export interface UpdateMonitorDTO extends Partial<CreateMonitorDTO> {
  isActive?: boolean;
}