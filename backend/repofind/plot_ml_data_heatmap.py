#!/usr/bin/env python3
"""
Plot a correlation heatmap for ml_train_data.csv.
Saves the figure to repofind/ml_train_data_heatmap.png (or path from argv).
Requires: pandas, matplotlib, seaborn.
"""

import sys
from pathlib import Path

import pandas as pd
import numpy as np

# Reuse feature list from training
from train_success_model import FEATURE_NAMES, DEFAULT_CSV

SCRIPT_DIR = Path(__file__).parent
DEFAULT_OUTPUT = SCRIPT_DIR / 'ml_train_data_heatmap.png'


def main():
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

    df = pd.read_csv(csv_path)
    df = df[df['status'].isin(['paid_out', 'too_easy'])]
    # Numeric matrix: features + target (status as 0/1)
    X = df.reindex(columns=FEATURE_NAMES).fillna(0).astype(float)
    y = (df['status'] == 'paid_out').astype(int)
    X['status'] = y  # so we see correlation with target in heatmap
    corr = X.corr()

    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import seaborn as sns
    except ImportError as e:
        print('Install matplotlib and seaborn: pip install matplotlib seaborn', file=sys.stderr)
        raise SystemExit(1) from e

    fig, ax = plt.subplots(figsize=(14, 12))
    sns.heatmap(
        corr,
        annot=False,
        fmt='.2f',
        cmap='RdBu_r',
        center=0,
        vmin=-0.5,
        vmax=0.5,
        square=False,
        linewidths=0.5,
        ax=ax,
    )
    ax.set_title('ML training data: feature correlation (and with status)')
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)
    plt.tight_layout()
    plt.savefig(out_path, dpi=120, bbox_inches='tight')
    plt.close()
    print(f"Heatmap saved: {out_path}")


if __name__ == '__main__':
    main()
