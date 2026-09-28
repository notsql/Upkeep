# 0016 - Devices use a fixed metric catalogue

## Status

Accepted.

## Decision

A device's supported metrics come from a server-side enum, and each metric has
exactly one unit (temperature °C, humidity %, pressure bar, flow rate L/min,
vibration mm/s, power kW, energy kWh). The device row stores only the metric
names, as a Postgres array. The unit is derived from the enum and returned
with each metric.

The device's foreign keys to its asset and location both carry `estateId`, so
the database rejects a device that spans estates, not only the service.

The identifier the manager enters is a label, unique across all estates. It is
not a credential; device authentication is ID-42's decision.

Rejected:
- **Free-text metrics and units.** "Temp" vs "temperature" and "C" vs "°C"
  would make ID-43's check for unsupported metrics and mismatched units
  unreliable.
- **A `DeviceMetric` table.** Nothing needs per-metric columns yet, and a
  metric's unit is fixed by the catalogue.

## Consequences

Adding a metric is a code change and a contract regeneration, not data entry.
Changing a metric's unit would reinterpret stored readings, so a unit is never
changed. A new metric is added instead.
