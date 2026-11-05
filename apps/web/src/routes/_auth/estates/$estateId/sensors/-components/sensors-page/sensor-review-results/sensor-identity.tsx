import type { MonitoredSensor } from "@/lib/flatlined-sensors";

export function SensorIdentity({ sensor }: { sensor: MonitoredSensor }) {
  return (
    <div className="wrap-anywhere">
      <p className="font-medium">{sensor.deviceIdentifier}</p>
      <p className="text-muted-foreground text-sm">{sensor.assetName}</p>
      <p className="text-muted-foreground text-sm">{sensor.assetReference}</p>
      {sensor.assetLocationPath === sensor.deviceLocationPath ? (
        <p className="text-muted-foreground mt-2 text-sm">
          Location: {sensor.assetLocationPath}
        </p>
      ) : (
        <div className="text-muted-foreground mt-2 text-sm">
          <p>Asset location: {sensor.assetLocationPath}</p>
          <p>Device location: {sensor.deviceLocationPath}</p>
        </div>
      )}
    </div>
  );
}
