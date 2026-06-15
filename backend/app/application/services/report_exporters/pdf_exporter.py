from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class PdfExporter:

    @staticmethod
    def export(
        title: str,
        headers: list[str],
        rows: list[list],
        output_path: str,
    ) -> str:

        Path(output_path).parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        # 1. Setup dokumen dengan ukuran A4 dan margin aman 36pt (0.5 inch)
        document = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()

        # 2. Definisikan gaya tulisan (Typography)
        style_header = ParagraphStyle(
            "TableHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=colors.whitesmoke,
            alignment=1,  # Center
        )

        style_cell = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            alignment=0,  # Left (Default untuk ID / Text panjang)
        )

        style_cell_center = ParagraphStyle(
            "TableCellCenter", parent=style_cell, alignment=1
        )  # Center
        
        style_cell_right = ParagraphStyle(
            "TableCellRight", parent=style_cell, alignment=2
        )  # Right (Untuk Amount)

        elements = []

        # 3. Bagian Judul (Title)
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            alignment=0,
            spaceAfter=12,
        )
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 8))

        # 4. Transformasi Headers ke Paragraph agar otomatis auto-wrap
        table_data = [[Paragraph(h, style_header) for h in headers]]

        # 5. Transformasi Rows ke Paragraph dengan Alignment Dinamis Berbasis Kata Kunci
        for row in rows:
            formatted_row = []
            for i, cell in enumerate(row):
                cell_text = str(cell) if cell is not None else ""

                # Bersihkan string nama class enum jika tidak sengaja lolos
                if "TransactionStatusEnum." in cell_text:
                    cell_text = cell_text.replace("TransactionStatusEnum.", "")

                # Deteksi alignment berdasarkan nama header kolomnya
                header_name = str(headers[i]).lower()
                if "amount" in header_name:
                    current_style = style_cell_right
                elif any(k in header_name for k in ["score", "level", "status", "time", "date"]):
                    current_style = style_cell_center
                else:
                    current_style = style_cell

                formatted_row.append(Paragraph(cell_text, current_style))

            table_data.append(formatted_row)

        # 6. Alokasi Lebar Kolom Secara Dinamis (Total ruang cetak A4 = 523pt)
        total_width = 523
        num_cols = len(headers)

        if num_cols == 7:
            # Alokasi presisi untuk versi ringkas (7 Kolom)
            col_widths = [90, 65, 85, 45, 55, 85, 98]
        elif num_cols == 9:
            # Alokasi presisi untuk versi lengkap (9 Kolom)
            col_widths = [65, 65, 55, 60, 65, 40, 45, 60, 68]
        else:
            # Fallback otomatis jika jumlah kolom di luar perkiraan
            col_widths = [total_width / num_cols] * num_cols

        # repeatRows=1 menjaga header tetap muncul di tiap halaman baru
        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # 7. Styling Tabel Modern Minimalis (Zebra Striping)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A1A1A")), # Header hitam premium
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")), # Garis abu-abu tipis clean
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ]
            )
        )

        elements.append(table)

        # Build PDF
        document.build(elements)

        return output_path