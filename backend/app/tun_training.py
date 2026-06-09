from app.infrastructure.ml.training import train_all

if __name__ == "__main__":
    print("Mulai proses training untuk Agenusa dan Nusabill...")
    hasil = train_all()
    print("Training Selesai! Model dan JSON tersimpan di folder:")
    print(hasil["agenusa"]["model_path"])