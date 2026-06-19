from app.infrastructure.storage.report_storage import ReportStorage

result = ReportStorage.upload_report(
    local_file_path="app/infrastructure/storage/test.txt",
    storage_path="test.txt",
)

print(result)