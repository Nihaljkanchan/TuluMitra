# Trained models go here

    models/
        whisper-tulu-lora/   ← from training/train_whisper_lora.py (adapter + processor + metrics.json)
        tulu-tts/            ← a VITS model fine-tuned on one speaker's Tulu (optional, see training/README.md)

Restart the backend after adding a model. GET /health shows what's loaded.
Base models (openai/whisper-small, facebook/mms-tts-kan) download
automatically from Hugging Face on first use and are cached, not stored here.
