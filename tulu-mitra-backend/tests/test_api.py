"""Smoke tests for every endpoint. Run: pytest -q
Speech models are switched off so the tests need no ML packages."""

import io
import os
import shutil
import tempfile
import wave
from pathlib import Path

# Tests write feedback, corrections and admin edits: give them a copy of the
# data folder so the real files are never touched.
_TMP = Path(tempfile.mkdtemp(prefix="tulumitra-test-"))
shutil.copytree(Path(__file__).resolve().parent.parent / "data", _TMP / "data",
                ignore=shutil.ignore_patterns("Tulu_Corpus_clean.txt"))
os.environ["DATA_DIR"] = str(_TMP / "data")
os.environ["LESSONS_FILE"] = str(_TMP / "data" / "tulu_lessons.json")
os.environ["STORAGE_DIR"] = str(_TMP / "storage")
os.environ["CORRECTIONS_EXPORT"] = str(_TMP / "corrections.tsv")
os.environ["ADMIN_PASSWORD"] = "test-pass"
os.environ["VOICE_CONVERSION"] = "off"

os.environ["ASR_MODE"] = "off"
os.environ["TTS_MODE"] = "off"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""

import pytest  # noqa: E402

from app import create_app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


def ask(client, text, memory=None, language="english"):
    r = client.post("/chat", json={"text": text, "language": language, "memory": memory or {}})
    assert r.status_code == 200
    return r.get_json()


def test_health(client):
    data = client.get("/health").get_json()
    assert data["status"] == "ok"
    assert data["dictionary"]["lexicon_entries"] > 100


def test_greeting_is_tulu(client):
    r = ask(client, "hello")
    assert r["lang"] == "tulu" and "ಸೊಲ್ಮೆಲು" in r["response"]


def test_translation(client):
    r = ask(client, "how do you say water in tulu")
    assert r["response"] == "ನೀರ್" and r["transliteration"] == "neer"


def test_numbers(client):
    assert ask(client, "what is 45 in tulu")["transliteration"] == "nalpa ain"
    assert len(ask(client, "count from 1 to 25")["blocks"][0]["items"]) == 20


def test_meaning(client):
    r = ask(client, "what does ನೀರ್ mean")
    assert r["blocks"][0]["type"] == "word"


def test_quiz_flow(client):
    r = ask(client, "quiz me")
    mem = r["memory"]
    answer = mem["quiz"]["answer"]["roman"]
    r2 = ask(client, answer, mem)
    assert r2["response"] == "ಸರಿ!"
    r3 = ask(client, "stop quiz", r2["memory"])
    assert r3["memory"]["quiz"] is None


def test_name_is_remembered(client):
    r = ask(client, "my name is nihal")
    assert r["memory"]["name"] == "Nihal"


def test_unknown_is_honest(client):
    r = ask(client, "what is the capital of france")
    assert r["source"] == "none"


def test_dictionary_all_directions(client):
    for q in ["water", "neer", "ನೀರ್", "ನೀರು", "nir"]:
        r = client.post("/dictionary", json={"word": q}).get_json()
        assert r["card"]["word"] == "ನೀರ್", q
    assert client.post("/dictionary", json={"word": "computer"}).get_json()["found"] is False


def test_translate_pairs(client):
    r = client.post("/translate", json={"text": "how are you", "source": "english", "target": "tulu"}).get_json()
    assert r["translation"] == "ಎಂಚ ಉಲ್ಲರ್?"
    r = client.post("/translate", json={"text": "ನನಗೆ ಗೊತ್ತಿಲ್ಲ", "source": "kannada", "target": "tulu"}).get_json()
    assert r["translation"] == "ಎಂಕ್ ಗೊತ್ತಿಜ್ಜಿ"
    r = client.post("/translate", json={"text": "ಮೀನ್", "source": "tulu", "target": "english"}).get_json()
    assert r["translation"] == "Fish"
    assert client.post("/translate", json={"text": "x", "source": "french", "target": "tulu"}).status_code == 400


def test_tts_without_engine_returns_no_audio(client):
    r = client.post("/tts", json={"text": "ನೀರ್"}).get_json()
    assert r["audio_url"] is None and r["reason"]


def test_asr_off_is_503(client):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\x00\x00" * 16000)
    buf.seek(0)
    r = client.post("/asr", data={"file": (buf, "a.wav")}, content_type="multipart/form-data")
    assert r.status_code == 503


def test_upload_voice(client):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\x00\x00" * 16000 * 8)
    buf.seek(0)
    r = client.post("/upload-voice", data={"file": (buf, "v.wav")}, content_type="multipart/form-data").get_json()
    assert r["ok"] and len(r["voice_id"]) == 16 and 7.5 < r["seconds"] < 8.5


def test_lessons_and_quiz_endpoints(client):
    assert len(client.get("/lessons").get_json()["categories"]) >= 4
    assert client.post("/learn", json={"category": "food"}).get_json()["id"] == "food"
    assert len(client.post("/quiz", json={}).get_json()["options"]) == 3


def test_llm_fallback_path(client, monkeypatch):
    """Open questions go to the LLM when configured (network stubbed out)."""
    from modules import llm
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "ask_json", lambda text, history=None, system=None: {
        "tulu": "ಯಕ್ಷಗಾನ ಎಡ್ಡೆ ಉಂಡು", "roman": "yakshagaana edde undu", "english": "Yakshagana is good",
        "explanation": "Yakshagana is a traditional theatre form."})
    r = ask(client, "tell me something about the moon")
    assert r["source"] == "llm" and r["lang"] == "tulu"
    assert any(b["type"] == "note" and "AI-generated" in b["text"] for b in r["blocks"])


def test_asr_pipeline_with_browser_webm(client, monkeypatch, tmp_path):
    """WebM from the browser → ffmpeg → 16 kHz WAV → model (stubbed)."""
    import shutil
    import subprocess
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    webm = tmp_path / "rec.webm"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5",
                    "-c:a", "libopus", str(webm)], check=True)
    seen = {}

    def fake_transcribe(self, wav_path):
        import wave
        with wave.open(str(wav_path)) as w:
            seen["rate"], seen["channels"] = w.getframerate(), w.getnchannels()
        return "ಎಂಚ ಉಲ್ಲರ್"

    from modules.asr import ASR
    monkeypatch.setattr(ASR, "transcribe", fake_transcribe)
    with open(webm, "rb") as f:
        r = client.post("/asr", data={"file": (f, "recording.webm")}, content_type="multipart/form-data")
    assert r.status_code == 200 and r.get_json()["text"] == "ಎಂಚ ಉಲ್ಲರ್"
    assert seen == {"rate": 16000, "channels": 1}


def test_corpus_word_without_meaning(client):
    """A Tulu word that's only in the corpus still gets real counts and sentences."""
    import config
    if not config.CORPUS_FILE.exists():
        pytest.skip("full corpus not present")
    card = client.post("/dictionary", json={"word": "ಯಕ್ಷಗಾನ"}).get_json()["card"]
    assert card["frequency"] > 50 and card["examples"]
    r = ask(client, "what does ಯಕ್ಷಗಾನ mean")
    assert r["blocks"][0]["type"] == "word" and r["blocks"][0]["frequency"] > 50


def test_tts_engine_order(monkeypatch):
    """Indian voice first when installed; falls back to the MMS Kannada voice if it fails."""
    import config
    from modules.tts import TTS
    monkeypatch.setattr(config, "TTS_MODE", "auto")
    monkeypatch.setattr(TTS, "_deps", staticmethod(lambda: True))
    tts = TTS(voices=None)
    monkeypatch.setattr(TTS, "_parler_installed", staticmethod(lambda: True))
    assert tts.planned_engine() == "indic_parler"
    assert tts.status()["speaker"] == config.TTS_SPEAKER
    tts.error = "download failed"          # e.g. the model couldn't load
    assert tts.planned_engine() == "kannada_proxy"
    monkeypatch.setattr(TTS, "_parler_installed", staticmethod(lambda: False))
    tts.error = None
    assert tts.planned_engine() == "kannada_proxy"


# ---------------------------------------------------------------- feedback
ADMIN = {"X-Admin-Password": "test-pass"}


def test_admin_needs_password(client):
    assert client.post("/admin/login").status_code == 401
    assert client.get("/admin/overview").status_code == 401
    o = client.get("/admin/overview", headers=ADMIN).get_json()
    assert o["lexicon_entries"] > 100 and "pending" in o["feedback"]
    assert client.post("/admin/login", headers={"X-Admin-Password": "nope"}).status_code == 401
    assert client.post("/admin/login", headers=ADMIN).get_json()["ok"]


def test_feedback_approve_is_used_everywhere(client):
    # 1. A visitor reports a wrong translation and gives the right one.
    before = client.post("/translate", json={"text": "good night", "source": "english", "target": "tulu"}).get_json()
    r = client.post("/feedback", json={
        "kind": "translation", "input": "good night", "direction": "english-tulu",
        "shown": {"tulu": before["translation"]},
        "suggested": {"tulu": "ಎಡ್ಡೆ ಇರ್ಲ್", "roman": "edde irl", "english": "Good night"},
        "note": "test",
    })
    assert r.status_code == 200 and r.get_json()["ok"]
    rid = r.get_json()["id"]
    # Empty reports are refused.
    assert client.post("/feedback", json={"kind": "chat"}).status_code == 400

    # 2. It waits for the admin.
    pending = client.get("/admin/feedback?status=pending", headers=ADMIN).get_json()["items"]
    assert any(x["id"] == rid for x in pending)
    same = client.post("/translate", json={"text": "good night", "source": "english", "target": "tulu"}).get_json()
    assert same["translation"] == before["translation"]

    # 3. Approved → used at once: translation, dictionary, export.
    ok = client.post(f"/admin/feedback/{rid}", json={"action": "approve"}, headers=ADMIN).get_json()
    assert ok["ok"] and ok["item"]["status"] == "approved"
    after = client.post("/translate", json={"text": "Good night", "source": "english", "target": "tulu"}).get_json()
    assert after["translation"] == "ಎಡ್ಡೆ ಇರ್ಲ್" and after["method"] == "correction"
    d = client.post("/dictionary", json={"word": "good night"}).get_json()
    assert d["found"] and d["card"]["word"] == "ಎಡ್ಡೆ ಇರ್ಲ್"
    tsv = client.get("/admin/export/corrections", headers=ADMIN).get_data(as_text=True)
    assert "ಎಡ್ಡೆ ಇರ್ಲ್" in tsv


def test_chat_correction_and_replacement(client):
    wrong = ask(client, "hello")["response"]
    rid = client.post("/feedback", json={
        "kind": "chat", "input": "hello", "shown": {"tulu": wrong},
        "suggested": {"tulu": "ಸೊಲ್ಮೆಲು! ಎಂಚ ಉಲ್ಲರ್?", "roman": "solmelu! encha ullar?", "english": "Hello! How are you?"},
    }).get_json()["id"]
    client.post(f"/admin/feedback/{rid}", json={"action": "approve"}, headers=ADMIN)
    r = ask(client, "Hello")
    assert r["response"] == "ಸೊಲ್ಮೆಲು! ಎಂಚ ಉಲ್ಲರ್?" and r["source"] == "correction"


def test_lesson_correction_and_reject(client):
    item = client.get("/content").get_json()["lessons"][0]["items"][0]
    rid = client.post("/feedback", json={
        "kind": "lesson", "input": item["tulu"], "shown": item,
        "suggested": {"tulu": item["tulu"], "english": "How are you? (polite)"},
    }).get_json()["id"]
    client.post(f"/admin/feedback/{rid}", json={"action": "approve"}, headers=ADMIN)
    assert client.get("/content").get_json()["lessons"][0]["items"][0]["english"] == "How are you? (polite)"
    rid2 = client.post("/feedback", json={"kind": "other", "note": "typo on About"}).get_json()["id"]
    r = client.post(f"/admin/feedback/{rid2}", json={"action": "reject"}, headers=ADMIN).get_json()
    assert r["item"]["status"] == "rejected"


def test_admin_edit_lexicon_and_restore(client):
    data = client.get("/admin/content/lexicon", headers=ADMIN).get_json()
    n = len(data["entries"])
    data["entries"].append({"tulu": "ಪರೀಕ್ಷೆ ಪದ", "roman": "pareekshe pada", "english": "test word"})
    r = client.put("/admin/content/lexicon", json=data, headers=ADMIN).get_json()
    assert r["ok"] and len(r["data"]["entries"]) == n + 1
    assert client.post("/dictionary", json={"word": "test word"}).get_json()["card"]["word"] == "ಪರೀಕ್ಷೆ ಪದ"
    # A duplicate is refused with a readable message; nothing is saved.
    data["entries"].append({"tulu": "ಪರೀಕ್ಷೆ ಪದ", "english": "again"})
    bad = client.put("/admin/content/lexicon", json=data, headers=ADMIN)
    assert bad.status_code == 400 and "twice" in bad.get_json()["error"]
    # Restore the previous version from the automatic backup.
    names = client.get("/admin/backups/lexicon", headers=ADMIN).get_json()["items"]
    assert names
    client.post("/admin/restore/lexicon", json={"backup": names[0]}, headers=ADMIN)
    assert len(client.get("/admin/content/lexicon", headers=ADMIN).get_json()["entries"]) == n


def test_admin_edit_lessons_and_greetings(client):
    lessons = client.get("/admin/content/lessons", headers=ADMIN).get_json()
    lessons["categories"][0]["items"].append({"tulu": "ಬಲೆ", "roman": "bale", "english": "Come"})
    assert client.put("/admin/content/lessons", json=lessons, headers=ADMIN).get_json()["ok"]
    assert client.get("/content").get_json()["lessons"][0]["items"][-1]["tulu"] == "ಬಲೆ"
    g = client.get("/admin/content/greetings", headers=ADMIN).get_json()
    g["questions"].append({"tulu": "ಎಂಚ ಉಲ್ಲರ್?", "english": "How are you?", "when": "morning", "visit": ""})
    assert client.put("/admin/content/greetings", json=g, headers=ADMIN).get_json()["ok"]
    assert client.get("/content").get_json()["greetings"]["questions"][-1]["when"] == ["morning"]
    g["questions"] = []
    assert client.put("/admin/content/greetings", json=g, headers=ADMIN).status_code == 400


def test_voice_status_explains_why(client):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\x00\x00" * 16000 * 8)
    buf.seek(0)
    r = client.post("/upload-voice", data={"file": (buf, "v.wav")}, content_type="multipart/form-data").get_json()
    st = r["status"]
    assert st["ready"] is False and "VOICE_CONVERSION=knnvc" in st["message"]
    st = client.get(f"/voice/status?voice_id={r['voice_id']}").get_json()
    assert st["conversion"]["sample"]["exists"]
    assert "upload it again" in client.get("/voice/status?voice_id=0123456789abcdef").get_json()["message"]


def test_personalised_speech_never_caches_a_failed_conversion(monkeypatch, tmp_path):
    """A failed conversion falls back to the normal voice with a note, and is retried next time."""
    import config
    from modules import tts as tts_mod
    from modules.voice import VoiceStore

    monkeypatch.setattr(config, "AUDIO_DIR", tmp_path)
    monkeypatch.setattr(config, "VOICE_CONVERSION", "knnvc")
    voices = VoiceStore()
    monkeypatch.setattr(voices, "path", lambda vid: tmp_path / "sample.wav")
    engine = tts_mod.TTS(voices)
    monkeypatch.setattr(engine, "_load_safely", lambda: None)
    engine.model, engine.engine = object(), "kannada_proxy"
    monkeypatch.setattr(engine, "_generate", lambda text, out: out.write_bytes(b"RIFF-base"))

    calls = {"n": 0}

    def broken(src, dst, vid):
        calls["n"] += 1
        raise RuntimeError("no internet for torch.hub")

    monkeypatch.setattr(voices, "convert", broken)
    r = engine.synthesize("ನೀರ್", "0123456789abcdef")
    assert r["file"] and not r["personalised"] and "no internet" in r["note"]
    engine.synthesize("ನೀರ್", "0123456789abcdef")
    assert calls["n"] == 2  # retried, not served from a bad cache

    monkeypatch.setattr(voices, "convert", lambda src, dst, vid: dst.write_bytes(b"RIFF-mine"))
    r = engine.synthesize("ನೀರ್", "0123456789abcdef")
    assert r["personalised"] and (tmp_path / r["file"]).read_bytes() == b"RIFF-mine"
    assert engine.synthesize("ನೀರ್")["file"] != r["file"]  # the normal voice stays separate


def test_recording_names_and_script():
    """Ab_001.wav → speaker Ab, sentence S001; the 160-line script loads."""
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "training"))
    from prepare_dataset import load_script, parse_name

    root = Path("/rec")
    assert parse_name(root / "Ab_001.wav", root) == ("Ab", "S001")
    assert parse_name(root / "Nihal-12.m4a", root) == ("Nihal", "S012")
    assert parse_name(root / "Abhishek" / "S007.wav", root) == ("Abhishek", "S007")
    assert parse_name(root / "notes.wav", root) == (None, None)
    script = load_script(Path(__file__).resolve().parent.parent / "training" / "recording_script.csv")
    assert len(script) == 160 and script["S066"]["tulu"] == "ಒಂಜಿ" and script["S017"]["status"] == "skip"


def test_openai_provider(monkeypatch):
    """With an OpenAI key, open questions go to OpenAI's chat API (stubbed)."""
    import config
    from modules import llm

    sent = {}

    class Fake:
        class chat:
            class completions:
                @staticmethod
                def create(**kw):
                    sent.update(kw)
                    msg = type("M", (), {"content": '{"tulu": "ಎಡ್ಡೆ", "roman": "edde", "english": "Good", "explanation": ""}'})
                    return type("R", (), {"choices": [type("C", (), {"message": msg})]})

    monkeypatch.setattr(config, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(config, "LLM_ENABLED", True)
    monkeypatch.setattr(config, "LLM_MODEL", "gpt-5-mini")
    monkeypatch.setattr(llm, "_client", Fake)
    data = llm.ask_json("why is the sky blue?", history=[{"role": "assistant", "text": "hi"}, {"role": "user", "text": "hello"}])
    assert data["tulu"] == "ಎಡ್ಡೆ"
    assert sent["model"] == "gpt-5-mini" and sent["messages"][0]["role"] == "system"
    assert sent["messages"][-1]["role"] == "user" and "sky" in sent["messages"][-1]["content"]
    assert sent["reasoning_effort"] == "low" and "max_tokens" not in sent
