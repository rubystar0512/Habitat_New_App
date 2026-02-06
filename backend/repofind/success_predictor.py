#!/usr/bin/env python3
"""
Load the trained success model and predict whether a commit is good for success.
Usage:
  - From Python: success_predictor.predict(habitate_score, difficulty_score, suitability_score [, threshold] [, **extra])
    extra: repo_id, file_changes, additions, ..., commit_month, commit_dow, multi_file, cross_directory,
            test_file_count, non_test_file_count, single_file_200plus, multi_file_300plus, has_test_changes, etc.
  - CLI: python success_predictor.py <habitate> <difficulty> <suitability> [threshold]
    (CLI uses only 3 scores; extra features default to 0)
Returns: probability of paid_out (good for success) and binary label (using saved or given threshold).
"""

import json
import sys
from pathlib import Path

import joblib
import pandas as pd

from train_success_model import FEATURE_NAMES

SCRIPT_DIR = Path(__file__).parent
MODEL_FILE = SCRIPT_DIR / 'success_model.joblib'
SCALER_FILE = SCRIPT_DIR / 'success_scaler.joblib'
CONFIG_FILE = SCRIPT_DIR / 'success_config.json'

_model = None
_scaler = None
_threshold = None


def _load():
    global _model, _scaler, _threshold
    if _model is None:
        _model = joblib.load(MODEL_FILE)
        _scaler = joblib.load(SCALER_FILE)
    if _threshold is None and CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                _threshold = float(json.load(f).get('threshold', 0.5))
        except (json.JSONDecodeError, TypeError):
            _threshold = 0.5
    elif _threshold is None:
        _threshold = 0.5
    return _model, _scaler, _threshold


def predict(habitate_score, difficulty_score, suitability_score, threshold=None, **extra_features):
    """
    Predict probability that the commit is good for success (paid_out).
    threshold: decision boundary (default: from success_config.json, else 0.5).
    extra_features: optional commit fields (repo_id, file_changes, ...). Missing values default to 0.
    Returns: (probability_paid_out, is_good_for_success).
    """
    model, scaler, default_thr = _load()
    thr = float(threshold) if threshold is not None else default_thr
    row = {name: 0 for name in FEATURE_NAMES}
    row['habitate_score'] = float(habitate_score)
    row['difficulty_score'] = float(difficulty_score)
    row['suitability_score'] = float(suitability_score)
    bool_features = {
        'is_merge', 'has_dependency_changes', 'is_behavior_preserving_refactor',
        'multi_file', 'cross_directory', 'many_directories', 'has_core_files',
        'large_single_file', 'multiple_high_additions', 'single_file_200plus', 'multi_file_300plus',
        'has_test_changes',
    }
    for k, v in extra_features.items():
        if k not in row:
            continue
        if k in bool_features:
            row[k] = 1 if v else 0
        else:
            row[k] = 0 if v is None else float(v)
    n_features = getattr(scaler, 'n_features_in_', len(FEATURE_NAMES))
    feature_cols = FEATURE_NAMES[:n_features]
    X = pd.DataFrame([{c: row[c] for c in feature_cols}], columns=feature_cols)
    X_scaled = scaler.transform(X)
    proba = model.predict_proba(X_scaled)[0]
    paid_out_idx = list(model.classes_).index(1) if 1 in model.classes_ else -1
    p = float(proba[paid_out_idx]) if paid_out_idx >= 0 else 0.0
    return p, p >= thr


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python success_predictor.py <habitate> <difficulty> <suitability> [threshold]", file=sys.stderr)
        sys.exit(1)
    h, d, s = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
    thr = float(sys.argv[4]) if len(sys.argv) > 4 else None
    prob, label = predict(h, d, s, threshold=thr)
    print(f"P(paid_out)={prob:.3f}, good_for_success={label}")
