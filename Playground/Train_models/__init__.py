"""Training and evaluation scripts for Isolation Forest models.

These scripts import from backend.isolation_engine which provides:
- DOMAIN_ISO_CONFIG: Configuration for different fraud domains
- build_features(): Feature engineering utilities
- load_isolation_model(): Load trained models
- load_isolation_meta(): Load model metadata
- score_history_isolation(): Scoring utilities

Path setup:
- Backend path is added to sys.path for proper imports
- Models saved to: Playground/models/
- Data loaded from: Playground/Data/
"""
