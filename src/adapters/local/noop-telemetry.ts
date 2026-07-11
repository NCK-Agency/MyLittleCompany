import type { Telemetry } from "@/ports/telemetry";

export class NoopTelemetry implements Telemetry {
  record(operation: string, metadata: Record<string, string | number | boolean>): void {
    void operation;
    void metadata;
  }
}
