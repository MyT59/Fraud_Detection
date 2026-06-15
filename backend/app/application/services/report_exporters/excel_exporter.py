from pathlib import Path

from openpyxl import Workbook  # type: ignore[import]


class ExcelExporter:

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

        workbook = Workbook()

        sheet = workbook.active
        sheet.title = "Report"

        sheet.append(headers)

        for row in rows:
            sheet.append(row)

        workbook.save(output_path)

        return output_path