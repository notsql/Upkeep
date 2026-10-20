"""Device-key simulation scenarios; standard library only."""

import importlib.util
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "simulate_pump", Path(__file__).parents[1] / "simulate-pump.py"
)
pump = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pump)


class FlatlineSimulationTests(unittest.TestCase):
    def test_constant_measurements_span_the_threshold_without_waiting(self):
        at = datetime(2026, 10, 20, 4, tzinfo=UTC)
        bodies = []
        with patch.object(pump, "now", return_value=at), patch.object(
            pump, "send", side_effect=lambda url, key, body: bodies.append(body)
        ), patch.object(pump.time, "sleep", side_effect=AssertionError("No sleeps")):
            pump.flatline("http://localhost:8080", "device-key", "TEMPERATURE", 60, 2)
        self.assertEqual([body["value"] for body in bodies], [45, 45, 45])
        self.assertEqual(bodies[0]["measuredAt"], "2026-10-20T03:58:00Z")
        self.assertEqual(bodies[-1]["measuredAt"], "2026-10-20T04:00:00Z")

    def test_includes_the_end_when_interval_does_not_divide_the_threshold(self):
        bodies = []
        with patch.object(pump, "send", side_effect=lambda url, key, body: bodies.append(body)):
            pump.flatline("http://localhost:8080", "device-key", "TEMPERATURE", 70, 2)
        times = [datetime.fromisoformat(body["measuredAt"]) for body in bodies]
        self.assertEqual((times[-1] - times[0]).total_seconds(), 120)
        self.assertTrue(all((b - a).total_seconds() <= 70 for a, b in zip(times, times[1:])))

    def test_recovery_sends_a_new_changed_measurement(self):
        bodies = []
        with patch.object(pump, "send", side_effect=lambda url, key, body: bodies.append(body)):
            pump.recovery("http://localhost:8080", "device-key", "TEMPERATURE")
        self.assertEqual(len(bodies), 1)
        self.assertNotEqual(bodies[0]["value"], pump.METRICS["TEMPERATURE"][1])


if __name__ == "__main__":
    unittest.main()
