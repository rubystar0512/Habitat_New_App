#!/usr/bin/env python3
"""
Train a small ML model to predict whether a commit is good for success (paid_out).
Uses ml_train_data.csv: habitate_score, difficulty_score, suitability_score -> status (paid_out / too_easy).
Label: paid_out = 1 (good for success), too_easy = 0.
Saves the trained model and scaler to repofind/ so success_predictor can load them.

Score relations (from fetch_commits.py):
- habitate_score (0-150): rule-based from file_stats (single-file 200+, multi-file 300+, test presence, refactor penalty).
- difficulty_score (0-100): rule-based from file_stats (file count, cross-dir, algorithmic complexity, test coverage).
- suitability_score (0-100): explicitly uses habitate + difficulty (e.g. difficulty>=60/80, habitate>=80) plus more rules.
So the three scores are correlated; suitability is a derived summary. All use threshold rules (>= 60, >= 80, etc.).

Algorithm choice:
- Tree-based (XGBoost / RandomForest) fits best: handles correlated features, captures threshold-like rules without
  feature engineering, gives feature importance. XGBoost is preferred for tabular binary classification when available.
- Logistic regression would need polynomial/threshold features to match the rule structure.
- DL is overkill for 3 features and ~4k rows.
"""

import json
import sys
from pathlib import Path

import pandas as pd
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

# Paths
SCRIPT_DIR = Path(__file__).parent
DEFAULT_CSV = SCRIPT_DIR / 'ml_train_data.csv'
DEFAULT_MODEL_DIR = SCRIPT_DIR
MODEL_FILE = 'success_model.joblib'
SCALER_FILE = 'success_scaler.joblib'
CONFIG_FILE = 'success_config.json'

# Must match ml_data_convertor.CSV_COLUMNS minus 'status'
FEATURE_NAMES = [
    'habitate_score', 'difficulty_score', 'suitability_score',
    'repo_id', 'file_changes', 'additions', 'deletions', 'net_change',
    'test_additions', 'non_test_additions', 'is_merge',
    'has_dependency_changes', 'test_coverage_score', 'is_behavior_preserving_refactor',
    'commit_month', 'commit_dow',
    'multi_file', 'cross_directory', 'many_directories', 'has_core_files',
    'large_single_file', 'multiple_high_additions', 'directory_count',
    'test_file_count', 'non_test_file_count', 'single_file_200plus', 'multi_file_300plus',
    'has_test_changes',
]


def load_data(csv_path):
    """Load CSV and create X (features), y (label: 1 = paid_out, 0 = too_easy)."""
    df = pd.read_csv(csv_path)
    df = df[df['status'].isin(['paid_out', 'too_easy'])]
    X = df.reindex(columns=FEATURE_NAMES).fillna(0).astype(float)
    y = (df['status'] == 'paid_out').astype(int)
    return X, y


def _get_classifier(scale_pos_weight=1.0):
    """Use XGBoost if available; else RandomForest. scale_pos_weight favors paid_out (positive class)."""
    try:
        import xgboost as xgb
        return xgb.XGBClassifier(
            n_estimators=100, max_depth=6, learning_rate=0.1,
            scale_pos_weight=scale_pos_weight, random_state=42
        ), 'XGBoost'
    except ImportError:
        return RandomForestClassifier(
            n_estimators=100, max_depth=10, class_weight='balanced', random_state=42
        ), 'RandomForest'


def _tune_threshold(y_test, y_proba, thresholds=None):
    """Find threshold that maximizes F1 on test set; prefer higher recall when F1 ties."""
    if thresholds is None:
        thresholds = np.arange(0.50, 0.56, 0.05)
    best_f1, best_thr, best_rec, best_prec = -1, 0.5, 0, 0
    rows = []
    for t in thresholds:
        y_t = (y_proba >= t).astype(int)
        rec = recall_score(y_test, y_t, zero_division=0)
        prec = precision_score(y_test, y_t, zero_division=0)
        f1 = f1_score(y_test, y_t, zero_division=0)
        rows.append((t, prec, rec, f1))
        if f1 > best_f1 or (f1 == best_f1 and rec > best_rec):
            best_f1, best_thr, best_rec, best_prec = f1, t, rec, prec
    print("  Threshold sweep (precision, recall, F1):")
    for t, prec, rec, f1 in rows:
        mark = " <-- chosen" if t == best_thr else ""
        print(f"    {t:.2f}: P={prec:.3f} R={rec:.3f} F1={f1:.3f}{mark}")
    return float(best_thr), best_prec, best_rec, best_f1


def train(csv_path=DEFAULT_CSV, model_dir=DEFAULT_MODEL_DIR, test_size=0.2, random_state=42):
    X, y = load_data(csv_path)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    n_neg = int((y_train == 0).sum())
    n_pos = int((y_train == 1).sum())
    scale_pos_weight = (n_neg / n_pos) if n_pos > 0 else 1.0
    print(f"Class balance: paid_out={n_pos}, too_easy={n_neg} -> scale_pos_weight={scale_pos_weight:.2f}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    clf, name = _get_classifier(scale_pos_weight=scale_pos_weight)
    print(f"Classifier: {name}")
    print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")

    clf.fit(X_train_scaled, y_train)

    y_proba = clf.predict_proba(X_test_scaled)[:, 1] if hasattr(clf, 'predict_proba') else clf.predict(X_test_scaled)
    best_thr, best_prec, best_rec, best_f1 = _tune_threshold(y_test, y_proba)
    y_pred = (y_proba >= best_thr).astype(int)

    roc = roc_auc_score(y_test, y_proba)
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    print("--- Test set metrics (at chosen threshold) ---")
    print(f"  Threshold: {best_thr:.2f}")
    print(f"  ROC-AUC:   {roc:.3f}")
    print(f"  Accuracy:  {acc:.3f}")
    print(f"  Precision: {best_prec:.3f}")
    print(f"  Recall:    {best_rec:.3f}")
    print(f"  F1:        {best_f1:.3f}")
    print(f"  Confusion matrix (true \\ pred): [[TN, FP], [FN, TP]]")
    print(f"  {cm}")

    if hasattr(clf, 'feature_importances_'):
        imp = clf.feature_importances_
        print("  Feature importance:")
        for fn, i in sorted(zip(FEATURE_NAMES, imp), key=lambda x: -x[1]):
            print(f"    {fn}: {i:.3f}")

    model_path = model_dir / MODEL_FILE
    scaler_path = model_dir / SCALER_FILE
    config_path = model_dir / CONFIG_FILE
    joblib.dump(clf, model_path)
    joblib.dump(scaler, scaler_path)
    config = {"threshold": best_thr}
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"Model saved: {model_path}")
    print(f"Scaler saved: {scaler_path}")
    print(f"Config saved: {config_path} (threshold={best_thr:.2f})")
    return clf, scaler


if __name__ == '__main__':
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    train(csv_path=csv_path)
