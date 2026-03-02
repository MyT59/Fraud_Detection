# Isolation Evaluation Summary

- Generated at (UTC): `2026-02-25T09:52:16.531365+00:00`
- Notes: Evaluasi isolation memakai dataset berlabel untuk benchmarking offline.

## agenusa

- Dataset: `backend\agenusa_pattern_dataset.csv`
- Rows: `5000`
- Fraud Rate: `0.0846`
- Contamination: `0.08` | Fit Anomaly Rate: `0.08`

| Scenario | Accuracy | Precision Fraud | Recall Fraud | F1 Fraud | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Default Model Boundary | 0.955 | 0.7475 | 0.706856 | 0.72661 | 0.939654 |
| Review Threshold (`0.001367`) | 0.947 | 0.658 | 0.777778 | 0.712893 | 0.939654 |
| Tuned Threshold (`-0.003933`) | 0.9104 | 0.483221 | 0.851064 | 0.616438 | 0.939654 |

- Review-threshold confusion matrix: `TN=4406, FP=171, FN=94, TP=329`
- Error samples saved: `false_positive_top5=5`, `false_negative_top5=5`

## nusabill

- Dataset: `backend\nusabill_pattern_dataset.csv`
- Rows: `5000`
- Fraud Rate: `0.081`
- Contamination: `0.1` | Fit Anomaly Rate: `0.1`

| Scenario | Accuracy | Precision Fraud | Recall Fraud | F1 Fraud | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Default Model Boundary | 0.927 | 0.54 | 0.666667 | 0.596685 | 0.964025 |
| Review Threshold (`-0.0`) | 0.927 | 0.54 | 0.666667 | 0.596685 | 0.964025 |
| Tuned Threshold (`-0.014794`) | 0.9144 | 0.484138 | 0.866667 | 0.621239 | 0.964025 |

- Review-threshold confusion matrix: `TN=4365, FP=230, FN=135, TP=270`
- Error samples saved: `false_positive_top5=5`, `false_negative_top5=5`
