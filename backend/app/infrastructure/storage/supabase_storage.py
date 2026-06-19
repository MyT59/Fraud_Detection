import os
from pathlib import Path
from app.core.config import settings

from supabase import create_client, Client


CONTENT_TYPE_MAP = {
    ".pdf": "application/pdf",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".json": "application/json",
}


class SupabaseStorage:

    _client: Client | None = None

    @classmethod
    def get_client(cls) -> Client:
        """
        Singleton Supabase Client
        """
        if cls._client is None:
            supabase_url = settings.SUPABASE_URL
            supabase_key = settings.SUPABASE_SERVICE_KEY

            print("DEBUG URL =", supabase_url)
            print("DEBUG KEY =", supabase_key)

            if not supabase_url:
                raise ValueError(
                    "SUPABASE_URL tidak ditemukan di environment"
                )

            if not supabase_key:
                raise ValueError(
                    "SUPABASE_SERVICE_KEY tidak ditemukan di environment"
                )

            cls._client = create_client(
                supabase_url,
                supabase_key,
            )

        return cls._client

    @classmethod
    def upload_file(
        cls,
        bucket_name: str,
        local_file_path: str,
        storage_path: str,
        overwrite: bool = True,
    ) -> str:
        """
        Upload file ke Supabase Storage

        Return:
            reports/report.pdf
        """

        client = cls.get_client()

        # Tentukan content-type berdasarkan ekstensi file, supaya browser
        # bisa render file (PDF/Excel/CSV) langsung saat dibuka via signed URL,
        # bukan men-download/tampilkan sebagai plain text.
        extension = Path(local_file_path).suffix.lower()
        content_type = CONTENT_TYPE_MAP.get(extension, "application/octet-stream")

        with open(local_file_path, "rb") as file:
            client.storage.from_(bucket_name).upload(
                path=storage_path,
                file=file,
                file_options={
                    "upsert": str(overwrite).lower(),
                    "content-type": content_type,
                },
            )

        return storage_path

    @classmethod
    def delete_file(
        cls,
        bucket_name: str,
        storage_path: str,
    ):
        client = cls.get_client()

        client.storage.from_(bucket_name).remove(
            [storage_path]
        )

    @classmethod
    def create_signed_url(
        cls,
        bucket_name: str,
        storage_path: str,
        expires_in: int = 3600,
    ) -> str:
        """
        Generate signed URL

        Default:
        3600 detik = 1 jam
        """

        client = cls.get_client()

        response = (
            client.storage
            .from_(bucket_name)
            .create_signed_url(
                storage_path,
                expires_in,
            )
        )

        return response["signedURL"]

    @classmethod
    def file_exists(
        cls,
        bucket_name: str,
        storage_path: str,
    ) -> bool:

        client = cls.get_client()

        folder = str(Path(storage_path).parent)

        files = (
            client.storage
            .from_(bucket_name)
            .list(folder)
        )

        filename = Path(storage_path).name

        return any(
            f["name"] == filename
            for f in files
        )