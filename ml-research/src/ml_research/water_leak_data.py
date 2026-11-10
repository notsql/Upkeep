"""Prepares the municipal complaints dataset for the water leak classifier.

Source (MIT licence):
https://www.kaggle.com/datasets/wajahattaj/civic-and-municipality-complaint-system-dataset

The dataset's 1,100 rows repeat far fewer sentences, wrapped in fixed template
phrases. Each row is reduced to its core sentence and each core sentence kept
once, so that a sentence can never sit on both sides of a train/test split.

Run from the repository root:

    ml-research/.venv/bin/python -m ml_research.water_leak_data \
        ml-research/data/water-leak/municipal_training_set_1100.csv \
        ml-research/data/water-leak
"""

import re
import sys
from pathlib import Path

import pandas as pd

WATER_LEAK = "WATER_LEAK"
NOT_LEAK = "NOT_LEAK"

LEAK_ISSUE_TYPES = {"water_leakage", "water-leak"}

# Added by the dataset's author to every complaint type, so they say nothing
# about the fault.
_ALERT_OPENING = re.compile(r"^(URGENT|EMERGENCY):\s*", re.IGNORECASE)
_ALERT_CLOSINGS = (
    "this situation is impacting hundreds",
    "immediate intervention required",
)
_OPENINGS = (
    "i've noticed that",
    "please look into",
    "there is a serious issue with",
    "i wanted to report that",
    "it's really frustrating that",
    "can someone please fix",
)
_CLOSINGS = (
    "i'm concerned about safety here",
    "this has been happening for a while now",
    "please address this as soon as possible",
    "this needs immediate attention",
    "it's becoming quite dangerous",
    "it's creating an eyesore for the neighborhood",
)

_WATER_WORDS = re.compile(
    r"leak|pipe|burst|hydrant|flood|drip|seep|plumb|water|puddl|sewer|sewage|\bwet\b|damp",
    re.IGNORECASE,
)

# Labels changed by the human review of water-word sentences, keyed by
# sentence_key(). Each entry breaks the definition in the spec: a leak is water
# escaping from a pipe, tap, tank or plumbing fitting.
LABEL_CORRECTIONS: dict[str, str] = {}


def sentence_key(text: str) -> str:
    """Identifies a sentence regardless of case, spacing and final punctuation."""
    return re.sub(r"\s+", " ", text).strip(" .!?").casefold()


def core_sentence(text: str) -> str:
    """Removes the template phrases, leaving what the complaint actually says."""
    core = _ALERT_OPENING.sub("", text.strip())
    lowered = core.lower()
    for closing in _ALERT_CLOSINGS:
        position = lowered.find(closing)
        if position != -1:
            core = core[:position]
            lowered = lowered[:position]

    changed = True
    while changed:
        changed = False
        core = core.strip()
        lowered = core.lower()
        for closing in _CLOSINGS:
            if lowered.rstrip(" .").endswith(closing):
                end = lowered.rstrip(" .").rfind(closing)
                core = core[:end]
                changed = True
                break
    core = core.strip()

    lowered = core.lower()
    for opening in _OPENINGS:
        if lowered.startswith(opening):
            core = core[len(opening) :].strip()
            break
    return core.strip()


def _preferred_text(group: pd.DataFrame) -> str:
    """Picks the most common wording, avoiding all-capitals copies."""
    mixed_case = group[group["sentence"] != group["sentence"].str.upper()]
    candidates = mixed_case if not mixed_case.empty else group
    return candidates["sentence"].value_counts().index[0]


def prepare(csv_path: Path | str) -> pd.DataFrame:
    """Returns one row per core sentence: key, sentence, label and row count."""
    rows = pd.read_csv(csv_path, usecols=["issue_type", "issue_description"])
    rows["sentence"] = rows["issue_description"].astype(str).map(core_sentence)
    rows["key"] = rows["sentence"].map(sentence_key)
    rows = rows[rows["key"] != ""]
    rows["label"] = rows["issue_type"].map(
        lambda issue: WATER_LEAK if issue in LEAK_ISSUE_TYPES else NOT_LEAK
    )

    conflicting = rows.groupby("key")["label"].nunique()
    conflicting = conflicting[conflicting > 1]
    if not conflicting.empty:
        raise ValueError(f"Sentences with conflicting labels: {list(conflicting.index)}")

    sentences = pd.DataFrame(
        [
            {
                "key": key,
                "sentence": _preferred_text(group),
                "label": LABEL_CORRECTIONS.get(key, group["label"].iloc[0]),
                "rows": len(group),
            }
            for key, group in rows.groupby("key", sort=True)
        ]
    )
    unknown = set(LABEL_CORRECTIONS) - set(sentences["key"])
    if unknown:
        raise ValueError(f"Label corrections match no sentence: {sorted(unknown)}")
    return sentences


def water_word_sentences(sentences: pd.DataFrame) -> pd.DataFrame:
    """The sentences a person must read before training."""
    mentions_water = sentences["sentence"].str.contains(_WATER_WORDS)
    return sentences[mentions_water].sort_values(["label", "sentence"])


def main(csv_path: str, output_dir: str) -> None:
    output = Path(output_dir)
    sentences = prepare(csv_path)
    sentences.to_csv(output / "sentences.csv", index=False)
    water_word_sentences(sentences).to_csv(output / "label-review.csv", index=False)
    print(sentences["label"].value_counts().to_string())


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
