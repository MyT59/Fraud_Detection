# Isolation Evaluation Summary

- Generated at (UTC): `2026-03-11T06:55:11.251176+00:00`
- Notes: Evaluasi isolation memakai dataset berlabel untuk benchmarking offline.

## agenusa

- Dataset: `backend\agenusa_pattern_dataset.csv`
- Rows: `5000`
- Fraud Rate: `0.0934`
- Contamination: `0.08` | Fit Anomaly Rate: `0.08`

| Scenario | Accuracy | Precision Fraud | Recall Fraud | F1 Fraud | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Default Model Boundary | 0.9602 | 0.826829 | 0.72591 | 0.77309 | 0.946098 |
| Review Threshold (`0.001367`) | 0.9562 | 0.756198 | 0.783726 | 0.769716 | 0.946098 |
| Tuned Threshold (`-0.00322`) | 0.9362 | 0.614551 | 0.850107 | 0.713387 | 0.946098 |

- Review-threshold confusion matrix: `TN=4415, FP=118, FN=101, TP=366`
- Error samples saved: `false_positive_top5=5`, `false_negative_top5=5`

## nusabill

- Dataset: `backend\nusabill_pattern_dataset.csv`
- Rows: `5000`
- Fraud Rate: `0.078`
- Contamination: `0.1` | Fit Anomaly Rate: `0.1`

| Scenario | Accuracy | Precision Fraud | Recall Fraud | F1 Fraud | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Default Model Boundary | 0.9216 | 0.498047 | 0.653846 | 0.56541 | 0.958917 |
| Review Threshold (`-0.0`) | 0.9216 | 0.498047 | 0.653846 | 0.56541 | 0.958917 |
| Tuned Threshold (`-0.01808`) | 0.909 | 0.456376 | 0.871795 | 0.599119 | 0.958917 |

- Review-threshold confusion matrix: `TN=4353, FP=257, FN=135, TP=255`
- Error samples saved: `false_positive_top5=5`, `false_negative_top5=5`
