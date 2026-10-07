# Tulu Mitra backend — works on Hugging Face Spaces (Docker), Render, Railway,
# or any server with Docker.
#   Light build (chat, dictionary, translate, lessons):  docker build -t tulu-mitra .
#   With speech models (Whisper, TTS):                   docker build --build-arg WITH_ML=1 -t tulu-mitra .
FROM python:3.11-slim

ARG WITH_ML=0
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces runs containers as user 1000.
RUN useradd -m -u 1000 app
WORKDIR /app

COPY requirements.txt requirements-ml.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    if [ "$WITH_ML" = "1" ]; then \
      pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
      pip install --no-cache-dir -r requirements-ml.txt ; \
    fi

COPY --chown=app:app . .
RUN mkdir -p storage && chown -R app:app /app
USER app

ENV PORT=7860 HF_HOME=/app/.cache/huggingface
EXPOSE 7860
# One worker: each worker would load its own copy of the speech models.
CMD gunicorn -w 1 --threads 4 --timeout 180 -b 0.0.0.0:${PORT} app:app
