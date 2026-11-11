# Device simulator

A local-only TanStack Start app that replays SKAB pump experiments to
`POST /device-api/telemetry`, so the anomaly scoring pipeline can be checked
end to end. It has no sign-in and is never deployed. Spec:
`.spec/features/streaming-anomaly-detection.md` ("Device simulator").

## Run it

From the repo root, with the API running (`pnpm dev:server`):

```bash
pnpm nx run @proj/device-simulator:dev
```

Then open http://localhost:3002. It needs no secrets.

1. Register a pump device in the web app with the five metrics
   (vibration acceleration, pressure, temperature, flow rate, power) and copy
   its device key.
2. Enter the API URL (default `http://localhost:8080`) and the device key. The
   key is a password field, sent only with each request and never logged.
   The API URL, device key and mode are remembered in this browser's
   `localStorage`; clear the fields to forget them.
3. Upload the CSV, pick an experiment and a mode:
   - **Backfill** shifts the experiment so its last row is now and sends it
     all at once, in batches of up to 500 readings.
   - **Live** shifts it so its first row is now and sends due readings every
     5 seconds. The wait runs on a dedicated Web Worker timer, so a hidden tab
     keeps sending on schedule; any delay is caught up from wall-clock time.
4. Start. Stop ends the run after the current batch.

## Getting the CSV

The CSV is not committed. Generate it from `ml-research/`:

```bash
cd ml-research
uv run python scripts/fetch_test_readings.py
```

This writes `ml-research/artifacts/pump-anomaly-platform/test-readings.csv`.
The file is parsed in the browser and never uploaded anywhere.

## Data licence

The readings come from SKAB (Skoltech Anomaly Benchmark,
https://github.com/waico/SKAB), which is licensed under GPL-3.0. The data is
downloaded locally by the script and is not redistributed in this repository.

## Tests

```bash
pnpm nx run @proj/device-simulator:test
```
