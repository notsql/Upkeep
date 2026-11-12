"""Prepares the municipal complaints dataset for the fault category classifier.

Same source and the same reduction as ``water_leak_data``: template phrases are
stripped and each core sentence is kept once, so a sentence can never sit on
both sides of a train/test split. The label is the report's category instead
of leak / not leak.

Run from the repository root:

    ml-research/.venv/bin/python -m ml_research.report_category_data \
        ml-research/data/report-classifier/municipal_training_set_1100.csv \
        ml-research/data/report-classifier
"""

import sys
from pathlib import Path

import pandas as pd

from ml_research.water_leak_data import _preferred_text, core_sentence, sentence_key

# The model's output order. Spring reads the probabilities in this order.
CATEGORIES = [
    "BROKEN_LIGHT",
    "DRAINAGE",
    "GRAFFITI",
    "ILLEGAL_DUMPING",
    "NOISE",
    "OTHER",
    "PARKING",
    "ROAD_DAMAGE",
    "RUBBISH",
    "WATER_LEAK",
]

ISSUE_TYPE_CATEGORIES = {
    "streetlight": "BROKEN_LIGHT",
    "drainage": "DRAINAGE",
    "graffiti": "GRAFFITI",
    "illegal-dumping": "ILLEGAL_DUMPING",
    "noise": "NOISE",
    "other": "OTHER",
    "illegal_parking": "PARKING",
    "pothole": "ROAD_DAMAGE",
    "garbage": "RUBBISH",
    "water_leakage": "WATER_LEAK",
    "water-leak": "WATER_LEAK",
}


def category(issue_type: str) -> str:
    """Maps a dataset issue_type to its category, refusing any it does not know."""
    try:
        return ISSUE_TYPE_CATEGORIES[issue_type]
    except KeyError:
        raise ValueError(f"Unknown issue_type: {issue_type!r}") from None


def prepare(csv_path: Path | str) -> pd.DataFrame:
    """Returns one row per core sentence: key, sentence, label, label index and row count."""
    rows = pd.read_csv(csv_path, usecols=["issue_type", "issue_description"])
    rows["label"] = rows["issue_type"].astype(str).str.strip().map(category)
    rows["sentence"] = rows["issue_description"].astype(str).map(core_sentence)
    rows["key"] = rows["sentence"].map(sentence_key)
    rows = rows[rows["key"] != ""]

    conflicting = rows.groupby("key")["label"].nunique()
    conflicting = conflicting[conflicting > 1]
    if not conflicting.empty:
        raise ValueError(f"Sentences with conflicting labels: {list(conflicting.index)}")

    sentences = pd.DataFrame(
        [
            {
                "key": key,
                "sentence": _preferred_text(group),
                "label": group["label"].iloc[0],
                "rows": len(group),
            }
            for key, group in rows.groupby("key", sort=True)
        ]
    )
    sentences["target"] = sentences["label"].map(CATEGORIES.index)
    return sentences


def main(csv_path: str, output_dir: str) -> None:
    sentences = prepare(csv_path)
    sentences.to_csv(Path(output_dir) / "category-sentences.csv", index=False)
    print(sentences["label"].value_counts().to_string())


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
