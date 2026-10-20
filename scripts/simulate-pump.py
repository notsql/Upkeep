#!/usr/bin/env python3
"""Simulated pump sensor for POST /device-api/readings (ID-43).

Sends readings to a running server with a real device key, and prints each
response. Standard library only: nothing to install.

  1. Register a device on a pump asset and generate its credential in the web app.
  2. export UPKEEP_DEVICE_KEY=upk_...
  3. python3 scripts/simulate-pump.py --scenario demo
     python3 scripts/simulate-pump.py --metric TEMPERATURE --metric VIBRATION

Scenarios:
  stream  A reading per metric every --interval seconds, drifting like a pump
          warming up. Runs until --count readings or Ctrl-C.
  demo    One of each case, then exits: a new reading (201), an identical retry
          (200), a conflicting value (409), a wrong unit (400), a late reading
          from 10 minutes ago (201) and a reading 10 minutes in the future (400).

The device must be registered for every metric sent, or the server answers 400.
"""

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta

# The server's catalogue (decision 0016): unit, then a pump baseline and jitter.
METRICS = {
    "TEMPERATURE": ("°C", 45.0, 0.4),
    "HUMIDITY": ("%", 55.0, 1.0),
    "PRESSURE": ("bar", 3.1, 0.05),
    "FLOW_RATE": ("L/min", 12.8, 0.3),
    "VIBRATION": ("mm/s", 2.8, 0.2),
    "VIBRATION_ACCELERATION": ("g", 0.42, 0.03),
    "POWER": ("kW", 5.6, 0.1),
    "ENERGY": ("kWh", 1200.0, 0.0),
}


def now() -> datetime:
    return datetime.now(UTC)


def send(url: str, key: str, body: dict) -> None:
    request = urllib.request.Request(
        url.rstrip("/") + "/device-api/readings",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            status, text = response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        status, text = error.code, error.read().decode("utf-8")
    except urllib.error.URLError as error:
        print(f"Cannot reach {url}: {error.reason}", file=sys.stderr)
        sys.exit(1)

    sent = "{metric} {value} {unit} at {measuredAt}".format(**body)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = {}
    detail = (
        payload.get("message")
        or f"stored value {payload.get('value')}, received {payload.get('receivedAt')}"
    )
    print(f"{status}  {sent}  ->  {detail}")
    if status == 401:
        print(
            "Key rejected. Check UPKEEP_DEVICE_KEY or generate a new credential.",
            file=sys.stderr,
        )
        sys.exit(1)


def reading(
    metric: str, value: float, measured_at: datetime, unit: str | None = None
) -> dict:
    return {
        "metric": metric,
        "value": round(value, 3),
        "unit": unit or METRICS[metric][0],
        "measuredAt": measured_at.isoformat().replace("+00:00", "Z"),
    }


def stream(url: str, key: str, metrics: list[str], interval: float, count: int) -> None:
    values = {metric: METRICS[metric][1] for metric in metrics}
    sent = 0
    while count == 0 or sent < count:
        at = now()
        for metric in metrics:
            _, _, jitter = METRICS[metric]
            if metric == "ENERGY":
                values[metric] += interval / 3600 * METRICS["POWER"][1]
            else:
                # A slow upward drift with noise: a pump warming up under load.
                values[metric] += jitter * (random.uniform(-1, 1) + 0.05)
            send(url, key, reading(metric, values[metric], at))
        sent += 1
        if count == 0 or sent < count:
            time.sleep(interval)


def demo(url: str, key: str, metric: str) -> None:
    _, base, _ = METRICS[metric]
    at = now()
    print("New reading, expect 201:")
    send(url, key, reading(metric, base, at))
    print("Identical retry after a dropped response, expect 200:")
    send(url, key, reading(metric, base, at))
    print("Different value for the same time, expect 409:")
    send(url, key, reading(metric, base + 5, at))
    print("Wrong unit, expect 400:")
    send(url, key, reading(metric, base, at + timedelta(seconds=1), unit="deg"))
    print("Buffered reading from 10 minutes ago, expect 201:")
    send(url, key, reading(metric, base - 0.5, at - timedelta(minutes=10)))
    print("Clock 10 minutes fast, expect 400:")
    send(url, key, reading(metric, base, at + timedelta(minutes=10)))


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8080",
        help="API base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--key",
        default=os.environ.get("UPKEEP_DEVICE_KEY"),
        help="Device API key. Defaults to $UPKEEP_DEVICE_KEY, kept out of history.",
    )
    parser.add_argument("--scenario", choices=["stream", "demo"], default="stream")
    parser.add_argument(
        "--metric",
        action="append",
        choices=sorted(METRICS),
        help="Metric to send; repeatable (default: TEMPERATURE). demo uses the first.",
    )
    parser.add_argument(
        "--interval", type=float, default=5.0, help="Seconds between stream readings"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=0,
        help="Stream rounds to send; 0 runs until Ctrl-C",
    )
    args = parser.parse_args()

    if not args.key:
        parser.error("no device key: set UPKEEP_DEVICE_KEY or pass --key")
    metrics = args.metric or ["TEMPERATURE"]

    try:
        if args.scenario == "demo":
            demo(args.url, args.key, metrics[0])
        else:
            stream(args.url, args.key, metrics, args.interval, args.count)
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
