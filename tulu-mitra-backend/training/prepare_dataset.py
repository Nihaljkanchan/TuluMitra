"""
Step 1 — turn raw recordings into a clean, split training set.

Name each recording after its sentence NUMBER in the recording script
(training/recording_script.csv, made from Tulu_Recording_Script.pdf):

    Ab_001.wav  Ab_002.wav …      (speaker "Ab", sentences 1, 2 …)
    Nihal_001.m4a …

Put them in training/recordings/ — either all together, or one folder per
speaker (then the folder name is the speaker):

    training/recordings/Ab_001.wav  Ab_002.wav  Nihal_001.wav …
    training/recordings/Abhishek/Ab_001.wav …

S001.wav / 001.wav work too inside a speaker folder. Any format ffmpeg can
read works (wav, mp3, m4a, ogg, webm, flac).

Sentences with a blank (17, 19, 25: "My name is ___") are different for each
speaker, so they are skipped unless you list what was actually said in
training/recordings/metadata.csv (columns: file,text,speaker):

    file,text,speaker
    Ab_017.wav,ಯಾನ ಪೆರು ಅಭಿಷೇಕ್ ಆಂಡ್,Ab

Run:
    python training/prepare_dataset.py --check   # just list what is there / missing
    python training/prepare_dataset.py           # build training/processed/
    python training/prepare_dataset.py --text roman   # train on the Latin spelling instead

It converts everything to 16 kHz mono WAV, trims silence at both ends,
drops clips that are too short/long or have no transcript, and writes
training/processed/{train,test}.csv plus report.json with the numbers you
will want for your project report (minutes, clips, speakers).

Transcripts: by default the Kannada-script column `tulu` of the script (the
app shows Tulu in Kannada script, so the speech model should write it the
same way). Those Kannada-script lines are a first draft made from the PDF's
Latin spelling: check them (and the `status`/`note` columns) with a Tulu
speaker before training. The transcript must match what was actually said.

Split choices:
  sentence (default) — 10% of the SENTENCES are held out entirely, so the
                       test set measures sentences the model never heard.
                       Sentences that appear twice in the script (e.g. 34
                       and 99) always land on the same side.
  speaker            — one whole speaker is held out: measures how well the
                       model handles a voice it never heard (needs ≥3 speakers).
Either way no test sentence/speaker leaks into training.
"""

import argparse
import csv
import json
import random
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import clean_transcript  # noqa: E402

AUDIO_EXT = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".aac", ".opus", ".mp4"}
MIN_S, MAX_S = 0.5, 30.0  # Whisper's window is 30 s


def load_script(path):
    with open(path, encoding="utf-8-sig") as f:
        return {row["id"].strip().upper(): row for row in csv.DictReader(f)}


# "Ab_001", "Nihal-12", "Ab 7", "S001", "001"
NAME_RE = re.compile(r"^(?:(?P<spk>.*?[A-Za-z].*?)[\s_\-.]*)?S?(?P<num>\d{1,4})$", re.I)


def parse_name(path, rec_dir):
    """(speaker, sentence id) from a file name like Ab_001.wav, or (None, None)."""
    m = NAME_RE.match(path.stem.strip())
    if not m:
        return None, None
    in_folder = path.parent != rec_dir
    speaker = path.parent.name if in_folder else (m.group("spk") or "").strip(" _-.")
    return speaker or None, f"S{int(m.group('num')):03d}"


def find_recordings(rec_dir, script, text_field="tulu"):
    """Yield (audio_path, text, speaker, sentence_id, problem)."""
    listed = set()
    meta = rec_dir / "metadata.csv"
    if meta.exists():
        with open(meta, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                p = (rec_dir / row["file"]).resolve()
                listed.add(p)
                spk, sid = parse_name(p, rec_dir)
                yield p, row["text"], row.get("speaker") or spk or p.parent.name, row.get("id") or sid or p.stem, None
    for p in sorted(rec_dir.rglob("*")):
        if p.suffix.lower() not in AUDIO_EXT or p.resolve() in listed:
            continue
        speaker, sid = parse_name(p, rec_dir)
        if not sid:
            yield p, None, speaker or p.parent.name, p.stem, "name has no sentence number (use e.g. Ab_001.wav)"
            continue
        if not speaker:
            yield p, None, "?", sid, "no speaker (name it like Ab_001.wav or put it in a speaker folder)"
            continue
        row = script.get(sid)
        if not row:
            yield p, None, speaker, sid, f"{sid} is not in recording_script.csv"
        elif (row.get("status") or "").strip().lower() == "skip":
            yield p, None, speaker, sid, "sentence has a blank (___): add what was said to metadata.csv"
        else:
            yield p, row.get(text_field) or row.get("tulu"), speaker, sid, None


def text_key(text):
    return re.sub(r"[\s?.!,]+", " ", (text or "").lower()).strip()


def convert(src, dst, trim=True):
    """16 kHz mono WAV, leading/trailing silence trimmed."""
    filters = ["silenceremove=start_periods=1:start_silence=0.1:start_threshold=-45dB",
               "areverse",
               "silenceremove=start_periods=1:start_silence=0.1:start_threshold=-45dB",
               "areverse"] if trim else []
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "16000", "-sample_fmt", "s16"]
    if filters:
        cmd += ["-af", ",".join(filters)]
    cmd.append(str(dst))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:200])


def duration(path):
    import wave

    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def check(args, script):
    """List recordings per speaker, missing sentence numbers and problems. Changes nothing."""
    by_speaker, problems, total_s = defaultdict(dict), [], 0.0
    for src, text, speaker, sid, problem in find_recordings(args.recordings, script, args.text):
        if problem:
            problems.append(f"{src.name}: {problem}")
            continue
        if sid in by_speaker[speaker]:
            problems.append(f"{src.name}: {speaker} already has {by_speaker[speaker][sid].name}")
            continue
        by_speaker[speaker][sid] = src
        try:
            import soundfile as sf

            info = sf.info(str(src))
            total_s += info.frames / info.samplerate
        except Exception:
            pass
    if not by_speaker and not problems:
        sys.exit(f"No recordings found in {args.recordings}")
    wanted = [k for k, r in script.items() if (r.get("status") or "").lower() != "skip"]
    print(f"Recordings in {args.recordings}\n")
    for spk, files in sorted(by_speaker.items()):
        missing = [int(k[1:]) for k in wanted if k not in files]
        print(f"  {spk}: {len(files)} sentences recorded")
        if missing:
            shown = ", ".join(map(str, missing[:40])) + (" …" if len(missing) > 40 else "")
            print(f"     not recorded yet ({len(missing)}): {shown}")
    if total_s:
        print(f"\n  total audio (WAV files): {total_s / 60:.1f} minutes")
    flagged = [k for k, r in script.items() if (r.get("status") or "").lower() == "check"]
    if flagged:
        print(f"\n  {len(flagged)} script lines are marked 'check' in recording_script.csv — review them with a")
        print("  Tulu speaker (see the note column) before training.")
    if problems:
        print("\n  Problems:")
        for p in problems:
            print("   -", p)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--recordings", default=HERE / "recordings", type=Path)
    ap.add_argument("--script", default=HERE / "recording_script.csv", type=Path)
    ap.add_argument("--out", default=HERE / "processed", type=Path)
    ap.add_argument("--split", choices=["sentence", "speaker"], default="sentence")
    ap.add_argument("--test-size", type=float, default=0.1, help="fraction of sentences held out")
    ap.add_argument("--test-speaker", help="speaker folder to hold out (with --split speaker)")
    ap.add_argument("--no-trim", action="store_true")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--text", choices=["tulu", "roman"], default="tulu",
                    help="transcript column: tulu (Kannada script, default) or roman (Latin spelling)")
    ap.add_argument("--check", action="store_true", help="only list what is there and what is missing")
    args = ap.parse_args()

    script = load_script(args.script) if args.script.exists() else {}
    if args.check:
        return check(args, script)

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required (Colab has it; locally: install ffmpeg)")
    audio_out = args.out / "audio"
    if args.out.exists():
        shutil.rmtree(args.out)
    audio_out.mkdir(parents=True)

    rows, skipped = [], Counter()
    seen = set()
    for src, text, speaker, sid, problem in find_recordings(args.recordings, script, args.text):
        if not src.exists():
            skipped["file missing"] += 1
            continue
        if problem:
            skipped[problem.split(":")[0].split(" (")[0]] += 1
            print(f"  ! {src.name}: {problem}")
            continue
        text = clean_transcript(text or "")
        if not text:
            skipped["no transcript"] += 1
            print(f"  ! no transcript for {src.name}")
            continue
        if (speaker, sid) in seen:
            skipped["second file for the same speaker and sentence"] += 1
            print(f"  ! {src.name}: {speaker} already has a recording of {sid} — kept the first")
            continue
        seen.add((speaker, sid))
        dst = audio_out / f"{speaker}__{sid}.wav"
        try:
            convert(src, dst, trim=not args.no_trim)
        except RuntimeError as exc:
            skipped["could not decode"] += 1
            print(f"  ! {src.name}: {exc}")
            continue
        d = duration(dst)
        if not MIN_S <= d <= MAX_S:
            skipped[f"duration outside {MIN_S}-{MAX_S}s"] += 1
            dst.unlink()
            continue
        rows.append({"audio": str(dst.resolve()), "text": text, "speaker": speaker, "id": sid, "duration": round(d, 2)})

    if not rows:
        sys.exit("No usable recordings found. Check the folder layout described at the top of this file.")

    random.seed(args.seed)
    speakers = sorted({r["speaker"] for r in rows})
    if args.split == "speaker":
        if len(speakers) < 2:
            sys.exit("--split speaker needs recordings from at least 2 speakers")
        held = args.test_speaker or speakers[-1]
        test_ids = None
        is_test = lambda r: r["speaker"] == held  # noqa: E731
    else:
        # Group by sentence TEXT, so a sentence that appears twice in the
        # script can't be in both train and test.
        groups = sorted({text_key(r["text"]) for r in rows})
        random.shuffle(groups)
        n_test = max(1, round(len(groups) * args.test_size))
        test_groups = set(groups[:n_test])
        is_test = lambda r: text_key(r["text"]) in test_groups  # noqa: E731

    splits = defaultdict(list)
    for r in rows:
        splits["test" if is_test(r) else "train"].append(r)

    for name in ("train", "test"):
        with open(args.out / f"{name}.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["audio", "text", "speaker", "id", "duration"])
            w.writeheader()
            w.writerows(splits[name])

    report = {
        "split": args.split,
        "transcripts": args.text,
        "speakers": {s: sum(1 for r in rows if r["speaker"] == s) for s in speakers},
        "clips": {k: len(v) for k, v in splits.items()},
        "hours": {k: round(sum(r["duration"] for r in v) / 3600, 3) for k, v in splits.items()},
        "unique_sentences": len({text_key(r["text"]) for r in rows}),
        "skipped": dict(skipped),
        "script_sentences_without_any_recording": sorted(set(script) - {r["id"] for r in rows})[:50],
    }
    (args.out / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\nDataset ready in", args.out)
    print(f"  speakers : {len(speakers)}  {report['speakers']}")
    print(f"  train    : {report['clips'].get('train', 0)} clips, {report['hours'].get('train', 0) * 60:.1f} min")
    print(f"  test     : {report['clips'].get('test', 0)} clips, {report['hours'].get('test', 0) * 60:.1f} min")
    if skipped:
        print("  skipped  :", dict(skipped))
    total_min = sum(report["hours"].values()) * 60
    if total_min < 60:
        print(f"\n  Note: {total_min:.0f} minutes of audio is a small dataset. Fine-tuning will help most on\n"
              "  the recorded sentences and similar ones; report WER on the held-out test set honestly.")


if __name__ == "__main__":
    main()
