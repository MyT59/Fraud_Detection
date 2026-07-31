import csv
from pathlib import Path


class CsvExporter:

    @staticmethod
    def _safe_cell(value):
        """Prevent spreadsheet applications from evaluating exported data as formulas."""
        if isinstance(value, str) and value[:1] in ("=", "+", "-", "@"):
            return "'" + value
        return value

    @staticmethod
    def export(
        headers: list[str],
        rows: list[list],
        output_path: str,
    ) -> str:

        Path(output_path).parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with open(
            output_path,
            mode="w",
            newline="",
            encoding="utf-8",
        ) as csv_file:

            writer = csv.writer(csv_file)

            writer.writerow(headers)

            for row in rows:
                writer.writerow([CsvExporter._safe_cell(cell) for cell in row])

        return output_path
