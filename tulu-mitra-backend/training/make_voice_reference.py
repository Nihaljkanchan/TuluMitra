"""
Use your recorded sentences as the reference for "My voice".

The website's "Add your voice" takes one 6–30 s clip. kNN-VC (the voice
converter behind "My voice") sounds closer to the speaker with MORE reference
audio — its authors report gains up to about 5 minutes. Your recording
sessions already have that much, so this script joins one speaker's clips
into a single reference file for the backend.

    python training/make_voice_reference.py --speaker Ab
    python training/make_voice_reference.py --speaker Nihal --minutes 5

It reads training/recordings/ (same naming as prepare_dataset.py:
Ab_001.wav … or a speaker folder), trims silence, joins up to --minutes of
audio, saves it to storage/voices/<voice id>.wav, and prints a link. Open
that link once in the browser: the site remembers the voice and switches
the Voice menu to "My voice".

Needs ffmpeg. Nothing is trained; the backend must have
VOICE_CONVERSION=knnvc and the speech packages (see README, "Personalised
voice").
"""

import argparse
import hashlib
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT))
from prepare_dataset import AUDIO_EXT, convert, parse_name  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--speaker", required=True, help="speaker name as in the file names, e.g. Ab")
    ap.add_argument("--recordings", default=HERE / "recordings", type=Path)
    ap.add_argument("--minutes", type=float, default=5.0)
    ap.add_argument("--site", default="http://localhost:5173", help="the website's address, for the printed link")
    args = ap.parse_args()

    import config  # the backend's settings: where voices are stored

    files = []
    for p in sorted(args.recordings.rglob("*")):
        if p.suffix.lower() in AUDIO_EXT:
            spk, sid = parse_name(p, args.recordings)
            if sid and (spk or "").lower() == args.speaker.lower():
                files.append((sid, p))
    if not files:
        sys.exit(f"No recordings for speaker '{args.speaker}' in {args.recordings} (expected names like {args.speaker}_001.wav)")

    voice_id = hashlib.md5(f"team:{args.speaker.lower()}".encode()).hexdigest()[:16]
    out = config.VOICES_DIR / f"{voice_id}.wav"
    limit = args.minutes * 60
    total, frames, params = 0.0, [], None
    with tempfile.TemporaryDirectory() as tmp:
        for sid, src in sorted(files):
            dst = Path(tmp) / f"{sid}.wav"
            try:
                convert(src, dst, trim=True)
            except RuntimeError as exc:
                print(f"  ! skipped {src.name}: {exc}")
                continue
            with wave.open(str(dst), "rb") as w:
                params = params or w.getparams()
                d = w.getnframes() / w.getframerate()
                frames.append(w.readframes(w.getnframes()))
                frames.append(b"\x00\x00" * int(0.25 * w.getframerate()))  # a short pause between clips
            total += d + 0.25
            if total >= limit:
                break
    if not frames:
        sys.exit("None of the recordings could be read.")
    with wave.open(str(out), "wb") as w:
        w.setparams(params)
        for f in frames:
            w.writeframes(f)

    print(f"Saved {total / 60:.1f} minutes of {args.speaker}'s voice from {len(frames) // 2} clips")
    print(f"  → {out}")
    print(f"\nVoice id: {voice_id}")
    print("Open this link once in the browser (with the backend running) to use it:")
    print(f"  {args.site.rstrip('/')}/?voice={voice_id}")


if __name__ == "__main__":
    main()
