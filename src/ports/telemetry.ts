export interface Telemetry {
  record(operation: string, metadata: Record<string, string | number | boolean>): void;
}
