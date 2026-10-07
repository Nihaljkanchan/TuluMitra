"""
Audio conversion. Browsers record WebM/Opus (Chrome) or MP4/AAC (Safari);
models need 16 kHz mono WAV. ffmpeg does the conversion — install it:
    Windows: winget install ffmpeg     macOS: brew install ffmpeg
    Ubuntu:  sudo apt install ffmpeg   (the Dockerfile already includes it)
"""

import shutil
import subprocess
import wave
from pathlib import Path


class AudioError(RuntimeError):
    pass


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def to_wav(src: Path, dst: Path, sample_rate: int = 16000) -> Path:
    """Any audio file → mono 16-bit WAV at `sample_rate`."""
    if ffmpeg_available():
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", str(sample_rate),
               "-sample_fmt", "s16", str(dst)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise AudioError(f"Could not decode audio: {result.stderr.strip()[:200]}")
        return dst
    # No ffmpeg: only WAV input can be handled.
    try:
        import soundfile as sf
        data, sr = sf.read(str(src), always_2d=True)
    except Exception as exc:
        raise AudioError("ffmpeg is not installed, so only WAV uploads can be read") from exc
    mono = data.mean(axis=1)
    if sr != sample_rate:
        try:
            import librosa
            mono = librosa.resample(mono, orig_sr=sr, target_sr=sample_rate)
        except ImportError as exc:
            raise AudioError("Install ffmpeg (or librosa) to resample audio") from exc
    sf.write(str(dst), mono, sample_rate, subtype="PCM_16")
    return dst


def duration_seconds(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except wave.Error:
        import soundfile as sf
        info = sf.info(str(path))
        return info.frames / float(info.samplerate)
