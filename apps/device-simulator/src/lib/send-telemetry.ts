import { createApiClient } from "@proj/api";
import { createServerFn } from "@tanstack/react-start";
import type { Reading } from "@/lib/readings";
import type { SendOutcome } from "@/lib/telemetry-outcome";
import { classifyResponse } from "@/lib/telemetry-outcome";

export interface SendTelemetryInput {
  apiUrl: string;
  deviceKey: string;
  readings: Reading[];
}

/**
 * Sends one batch to POST /device-api/telemetry from the simulator's server,
 * so the browser never calls Spring. The device key is used only for this
 * request's Authorization header and is never logged or returned.
 */
export const sendTelemetry = createServerFn({ method: "POST" })
  .validator((input: SendTelemetryInput) => input)
  .handler(async ({ data }): Promise<SendOutcome> => {
    const client = createApiClient({
      baseUrl: data.apiUrl,
      getToken: () => data.deviceKey,
    });
    try {
      const {
        data: body,
        error,
        response,
      } = await client.POST("/device-api/telemetry", {
        body: { readings: data.readings },
      });
      return classifyResponse(response.status, body ?? error);
    } catch {
      return { kind: "retryable", message: `Could not reach ${data.apiUrl}.` };
    }
  });
