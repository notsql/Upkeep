"""Fine-tunes MiniLM for the report classifiers (notebooks 04 to 07)."""

import random

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from transformers.utils import logging as hf_logging

hf_logging.set_verbosity_error()
hf_logging.disable_progress_bar()

BASE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
MAX_TOKENS = 128
BATCH_SIZE = 16
WEIGHT_DECAY = 0.01

device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def encode(batch: list[str]):
    return tokenizer(
        batch, truncation=True, max_length=MAX_TOKENS, padding=True, return_tensors="pt"
    ).to(device)


def train_model(
    train_texts: list[str],
    train_labels: np.ndarray,
    epochs: int,
    learning_rate: float,
    class_weight: str,
    seed: int,
    num_labels: int = 2,
):
    """Trains a classifier. With two labels, class 1 is WATER_LEAK."""
    set_seed(seed)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL, num_labels=num_labels).to(device)
    counts = np.bincount(train_labels, minlength=num_labels)
    balanced = len(train_labels) / (num_labels * counts)
    weights = {"balanced": balanced, "sqrt": np.sqrt(balanced), "none": np.ones(num_labels)}[class_weight]
    weights = torch.tensor(weights, dtype=torch.float32, device=device)
    loss_function = torch.nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=WEIGHT_DECAY)
    order = np.arange(len(train_texts))
    rng = np.random.default_rng(seed)
    model.train()
    for _ in range(epochs):
        rng.shuffle(order)
        for start in range(0, len(order), BATCH_SIZE):
            index = order[start : start + BATCH_SIZE]
            inputs = encode([train_texts[i] for i in index])
            targets = torch.tensor(train_labels[index], device=device)
            optimizer.zero_grad()
            loss = loss_function(model(**inputs).logits, targets)
            loss.backward()
            optimizer.step()
    return model


@torch.no_grad()
def predict_logits(model, batch_texts: list[str]) -> np.ndarray:
    model.eval()
    logits = [
        model(**encode(batch_texts[start : start + 64])).logits.cpu()
        for start in range(0, len(batch_texts), 64)
    ]
    return torch.cat(logits).numpy()
