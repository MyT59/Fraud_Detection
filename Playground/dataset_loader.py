from pathlib import Path
from functools import lru_cache

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[4]

DATA_DIR = BASE_DIR / "Playground" / "Data"

AGENUSA_DATASET_PATH = (
    DATA_DIR / "agenusa_pattern_dataset.csv"
)

NUSABILL_DATASET_PATH = (
    DATA_DIR / "nusabill_pattern_dataset.csv"
)


class DatasetLoader:

    @staticmethod
    @lru_cache(maxsize=1)
    def load_agenusa_dataset() -> pd.DataFrame:

        return pd.read_csv(
            AGENUSA_DATASET_PATH
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def load_nusabill_dataset() -> pd.DataFrame:

        return pd.read_csv(
            NUSABILL_DATASET_PATH
        )

    @staticmethod
    def load_all_datasets():

        agenusa_df = (
            DatasetLoader.load_agenusa_dataset()
        )

        nusabill_df = (
            DatasetLoader.load_nusabill_dataset()
        )

        return {
            "agenusa": agenusa_df,
            "nusabill": nusabill_df
        }