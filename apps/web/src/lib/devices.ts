import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type Device = components["schemas"]["DeviceResponse"];
export type DeviceInput = components["schemas"]["CreateDeviceRequest"];
export type DeviceMetric = DeviceInput["metrics"][number];
export type DeviceCredential =
  components["schemas"]["DeviceCredentialResponse"];

/**
 * The server's metric catalogue, in its order (decision 0016). Units are shown
 * while choosing; registered devices display the unit the API returns.
 */
export const deviceMetrics: Record<
  DeviceMetric,
  { name: string; unit: string }
> = {
  TEMPERATURE: { name: "Temperature", unit: "°C" },
  HUMIDITY: { name: "Humidity", unit: "%" },
  PRESSURE: { name: "Pressure", unit: "bar" },
  FLOW_RATE: { name: "Flow rate", unit: "L/min" },
  VIBRATION: { name: "Vibration", unit: "mm/s" },
  POWER: { name: "Power", unit: "kW" },
  ENERGY: { name: "Energy", unit: "kWh" },
};

export const MAX_REPORTING_INTERVAL_SECONDS = 86_400;

export function formatInterval(seconds: number): string {
  return seconds === 1 ? "Every second" : `Every ${seconds} seconds`;
}

export function devicesQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string
) {
  return ["estates", userId, "devices", estateId, assetId] as const;
}

export function useDevices(estateId: string, assetId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: devicesQueryKey(userId, estateId, assetId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/devices",
        { params: { path: { estateId, assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useRegisterDevice(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: DeviceInput) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{assetId}/devices",
        { params: { path: { estateId, assetId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: devicesQueryKey(userId, estateId, assetId),
      }),
  });
}

/** The response carries the plaintext key; it is never cached or refetched. */
export function useIssueDeviceCredential(estateId: string, assetId: string) {
  const { userId } = useEstateSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId: string): Promise<DeviceCredential> => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential",
        { params: { path: { estateId, assetId, deviceId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: devicesQueryKey(userId, estateId, assetId),
      }),
  });
}
