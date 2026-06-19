from app.infrastructure.storage.supabase_storage import SupabaseStorage


class ReportStorage:

    BUCKET_NAME = "reports"

    @classmethod
    def upload_report(
        cls,
        local_file_path: str,
        storage_path: str,
    ) -> str:

        return SupabaseStorage.upload_file(
            bucket_name=cls.BUCKET_NAME,
            local_file_path=local_file_path,
            storage_path=storage_path,
        )

    @classmethod
    def generate_download_url(
        cls,
        storage_path: str,
        expires_in: int = 3600,
    ) -> str:

        return SupabaseStorage.create_signed_url(
            bucket_name=cls.BUCKET_NAME,
            storage_path=storage_path,
            expires_in=expires_in,
        )

    @classmethod
    def delete_report(
        cls,
        storage_path: str,
    ):

        return SupabaseStorage.delete_file(
            bucket_name=cls.BUCKET_NAME,
            storage_path=storage_path,
        )