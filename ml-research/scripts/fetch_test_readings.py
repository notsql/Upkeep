"""Download SKAB's held-out test experiments and write test-readings.csv.

Run from ml-research/: uv run python scripts/fetch_test_readings.py

Reproduces artifacts/pump-anomaly-platform/test-readings.csv exactly as
notebook 03 writes it, without running the notebooks.
"""

import hashlib
import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "skab"
OUTPUT = ROOT / "artifacts" / "pump-anomaly-platform" / "test-readings.csv"
RAW_URL = "https://raw.githubusercontent.com/waico/SKAB/master/data"
EXPECTED_SHA256 = "1b67335257dc1e3e546bc71dd7f3685da53b875cde40b8c812ddda3c07fc6170"

# The test_files of notebook 03's split (metrics.json).
TEST_FILES = [
    "other/2.csv",
    "other/3.csv",
    "other/8.csv",
    "valve1/1.csv",
    "valve1/7.csv",
    "valve1/9.csv",
    "valve1/10.csv",
    "valve2/2.csv",
]
COLUMNS = [
    "experiment",
    "timestamp",
    "vibrationAcceleration",
    "pressure",
    "temperature",
    "flowRate",
    "power",
    "anomaly",
]


def download(rel: str) -> None:
    target = DATA_DIR / rel
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")
    try:
        urllib.request.urlretrieve(f"{RAW_URL}/{rel}", partial)
    except Exception as exc:
        partial.unlink(missing_ok=True)
        sys.exit(f"Failed to download {rel}: {exc}")
    partial.rename(target)


def load(rel: str) -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / rel, sep=";", index_col="datetime", parse_dates=True)
    return pd.DataFrame(
        {
            "experiment": rel,
            "datetime": df.index,
            "vibrationAcceleration": df["Accelerometer1RMS"].to_numpy(),
            "pressure": df["Pressure"].to_numpy(),
            "temperature": df["Temperature"].to_numpy(),
            "flowRate": df["Volume Flow RateRMS"].to_numpy(),
            # Apparent power: ignores power factor.
            "power": (df["Current"] * df["Voltage"] / 1000).to_numpy(),
            "anomaly": df["anomaly"].astype(int).to_numpy(),
        }
    )


def main() -> None:
    for rel in TEST_FILES:
        download(rel)
    readings = pd.concat([load(rel) for rel in TEST_FILES], ignore_index=True)
    readings = readings.sort_values(["experiment", "datetime"])
    readings["timestamp"] = readings["datetime"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    readings[COLUMNS].to_csv(OUTPUT, index=False)

    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    print(f"{OUTPUT.relative_to(ROOT)}: {len(readings)} rows, sha256 {digest}")
    if digest != EXPECTED_SHA256:
        sys.exit(f"Hash mismatch: expected {EXPECTED_SHA256}")


if __name__ == "__main__":
    main()
