"""
Tulu Mitra — Flask REST API.

Run locally:     python app.py            → http://localhost:8000
In production:   gunicorn -w 1 --threads 4 -b 0.0.0.0:$PORT app:app

Endpoints used by the website (see README.md for request/response shapes):
    POST /chat          text → Tulu reply (+ meaning, suggestions, memory)
    POST /asr           audio file → transcribed text
    POST /dictionary    word → meaning, Kannada, corpus frequency, examples
    POST /translate     text + language pair → translation
    POST /tts           text → audio url
    POST /upload-voice  voice sample → voice_id (and starts preparing it)
    GET  /voice/status  is the personalised voice ready? (and why not)
    POST /feedback      a visitor reports a mistake with the correct words
    GET  /content       lessons + greetings (edited on the Admin page)
Admin page (needs ADMIN_PASSWORD in .env, sent as the X-Admin-Password header):
    POST /admin/login   GET /admin/overview   GET /admin/feedback
    POST /admin/feedback/<id>   GET|PUT /admin/content/<name>
    GET /admin/backups/<name>   POST /admin/restore/<name>
    GET /admin/export/corrections
Extra endpoints kept from the original API:
    GET  /health  GET /lessons  POST /learn  POST /quiz  POST /intent
    POST /search  GET /dictionary/top  GET /audio/<file>
"""

import hmac
import logging
import time
import uuid

from flask import Flask, Response, abort, jsonify, request, send_from_directory
from flask_cors import CORS

import config
from modules.asr import ASR, ASRUnavailable
from modules.audio_utils import AudioError, ffmpeg_available, to_wav
from modules.concept_teaching import Teacher
from modules.conversation import Conversation
from modules import admin_content
from modules import auth
from modules.dictionary import TuluDictionary
from modules.feedback import TRAINING_FILE, Feedback
from modules.store import BACKUP_DIR, backups
from modules.intent_detector import detect
from modules.translation import Translator
from modules.tts import TTS
from modules.voice import VoiceStore
from modules import llm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("tulu-mitra")

PAIRS = {("english", "tulu"), ("kannada", "tulu"), ("tulu", "english")}
LANGS = {"english", "kannada", "tulu"}


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_MB * 1024 * 1024
    app.json.ensure_ascii = False  # send Kannada script as-is, not \\u escapes
    CORS(app, origins=config.ALLOWED_ORIGINS)
    auth.register(app)

    started = time.time()
    feedback = Feedback()
    dictionary = TuluDictionary()
    feedback.apply_to_entries(dictionary.entries)
    dictionary.add_sentences(feedback.sentences())
    teacher = Teacher(dictionary, feedback)
    translator = Translator(dictionary)
    conversation = Conversation(dictionary, teacher, translator)
    voices = VoiceStore()
    asr = ASR()
    tts = TTS(voices)

    # ------------------------------------------------------------ helpers
    def body():
        data = request.get_json(silent=True)
        return data if isinstance(data, dict) else {}

    def audio_url(name):
        return f"{config.PUBLIC_URL}/audio/{name}" if name else None

    def save_upload(field_names=("file", "audio")):
        f = next((request.files[n] for n in field_names if n in request.files), None)
        if f is None:
            abort(400, description="No audio file in the request (form field 'file')")
        suffix = "." + (f.filename.rsplit(".", 1)[-1][:5] if f.filename and "." in f.filename else "webm")
        path = config.UPLOADS_DIR / f"{uuid.uuid4().hex}{suffix}"
        f.save(path)
        return path

    # ------------------------------------------------------------- health
    @app.get("/")
    def index():
        return jsonify({"name": "Tulu Mitra API", "docs": "See README.md", "health": "/health"})

    @app.get("/health")
    def health():
        return jsonify({
            "status": "ok",
            "uptime_seconds": int(time.time() - started),
            "dictionary": dictionary.stats(),
            "lessons": len(teacher.categories),
            "llm": {"enabled": llm.available(), "provider": llm.provider(),
                    "model": config.LLM_MODEL if llm.available() else None},
            "asr": asr.status(),
            "tts": tts.status(),
            "ffmpeg": ffmpeg_available(),
        })

    # --------------------------------------------------------------- chat
    @app.post("/chat")
    def chat():
        data = body()
        text = (data.get("text") or data.get("message") or "").strip()
        if not text:
            abort(400, description="'text' is required")
        language = data.get("language") if data.get("language") in LANGS else "english"
        memory = data.get("memory") or {}
        # An approved correction for exactly this question wins.
        reply = feedback.answer_chat(text)
        if reply:
            reply["memory"] = memory
        else:
            reply = conversation.respond(text, language, history=data.get("history") or [], memory=memory)
        reply = feedback.fix(reply)
        if data.get("with_audio") and reply.get("lang") == "tulu":
            speech = tts.synthesize(reply["response"], data.get("voice_id"))
            reply["audio_url"] = audio_url(speech["file"])
            reply["tts_engine"] = speech["engine"]
        else:
            reply["audio_url"] = None
        return jsonify(reply)

    @app.post("/intent")
    def intent():
        return jsonify(detect(body().get("text", "")))

    # ---------------------------------------------------------------- asr
    @app.post("/asr")
    def speech_to_text():
        src = save_upload()
        wav = src.with_name(f"{src.stem}_16k.wav")  # never the same path as the upload
        try:
            to_wav(src, wav)
            text = asr.transcribe(wav)
            return jsonify({"text": text, "fine_tuned": asr.adapter_loaded})
        except AudioError as exc:
            return jsonify({"error": str(exc)}), 400
        except ASRUnavailable as exc:
            return jsonify({"error": str(exc)}), 503
        finally:
            src.unlink(missing_ok=True)
            wav.unlink(missing_ok=True)

    # --------------------------------------------------------- dictionary
    @app.post("/dictionary")
    def lookup():
        data = body()
        word = (data.get("word") or data.get("query") or "").strip()
        if not word:
            abort(400, description="'word' is required")
        return jsonify(feedback.fix(dictionary.lookup(word)))

    @app.post("/search")
    def corpus_search():
        data = body()
        return jsonify({"results": dictionary.search(data.get("keyword") or data.get("query") or "", int(data.get("n", 10)))})

    @app.get("/dictionary/top")
    def top_words():
        return jsonify({"words": dictionary.top_words(min(500, int(request.args.get("n", 50))))})

    # ---------------------------------------------------------- translate
    @app.post("/translate")
    def translate():
        data = body()
        text = (data.get("text") or "").strip()
        source, target = data.get("source"), data.get("target")
        if (not source or not target) and data.get("language_pair"):
            source, _, target = data["language_pair"].partition("-")
        if (source, target) not in PAIRS:
            abort(400, description="Supported pairs: english-tulu, kannada-tulu, tulu-english")
        if not text:
            abort(400, description="'text' is required")
        fixed = feedback.answer_translation(text, source, target)
        return jsonify(fixed or feedback.fix(translator.translate(text, source, target)))

    # ---------------------------------------------------------------- tts
    @app.post("/tts")
    def text_to_speech():
        data = body()
        text = (data.get("text") or "").strip()
        if not text:
            abort(400, description="'text' is required")
        speech = tts.synthesize(text[:600], data.get("voice_id"))
        engine = speech["engine"]
        return jsonify({
            "audio_url": audio_url(speech["file"]),
            "engine": engine,
            "is_tulu_voice": engine == "tulu_vits",
            "is_indian_voice": engine in ("tulu_vits", "indic_parler", "kannada_proxy"),
            "personalised": speech["personalised"],
            "note": speech["note"],
            "reason": None if speech["file"] else "No speech engine is available on this server",
        })

    @app.get("/audio/<path:name>")
    def audio(name):
        return send_from_directory(config.AUDIO_DIR, name, mimetype="audio/wav", max_age=86400)

    # ------------------------------------------------------- upload voice
    @app.post("/upload-voice")
    def upload_voice():
        src = save_upload()
        try:
            info = voices.save(src)
            # Start loading the models now, so the first play isn't a long wait.
            tts.warmup()
            voices.prepare(info["voice_id"])
            return jsonify({"ok": True, **info, "status": voice_status(info["voice_id"])})
        except AudioError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        finally:
            src.unlink(missing_ok=True)

    def voice_status(voice_id):
        """Plain answer to "is my voice being used, and if not, why?"."""
        v = voices.status(voice_id)
        t = tts.status()
        sample = v.get("sample") or {}
        if voice_id and not sample.get("exists"):
            ready, msg = False, "The server doesn't have this voice sample (it may have restarted). Please upload it again."
        elif not v["enabled"]:
            ready, msg = False, ("Your sample is saved, but personalisation is switched off on the server. "
                                 "Set VOICE_CONVERSION=knnvc in the backend's .env file and restart it.")
        elif t["state"] == "missing ML packages" or v["state"] == "missing packages":
            ready, msg = False, ("Your sample is saved, but the server has no speech packages yet. "
                                 "Run: pip install -r requirements-ml.txt, then restart the backend.")
        elif not t["engine"]:
            ready, msg = False, "The server has no speech engine configured, so there is nothing to convert."
        elif v["state"] == "error":
            ready, msg = False, f"The voice converter could not start. {v['error'] or ''}"
        elif v["state"] == "loading" or t["state"] == "loading":
            ready, msg = False, ("Preparing your voice… The first time, the server downloads the voice-conversion "
                                 "model (about 1.3 GB), which can take several minutes. Keep the backend running.")
        elif v["state"] == "ready":
            ready, msg = True, "Ready. Choose “My voice” in the Voice menu to hear answers in your voice."
        else:
            ready, msg = False, "Not loaded yet. It will load when you test or play your voice."
        return {"ready": ready, "message": msg, "conversion": v, "tts": t}

    @app.get("/voice/status")
    def voice_status_route():
        return jsonify(voice_status(request.args.get("voice_id")))

    @app.post("/voice/prepare")
    def voice_prepare():
        vid = body().get("voice_id")
        tts.warmup()
        voices.prepare(vid)
        return jsonify(voice_status(vid))

    # ------------------------------------------------------------ feedback
    @app.post("/feedback")
    def submit_feedback():
        try:
            r = feedback.submit(body())
        except ValueError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        return jsonify({"ok": True, "id": r["id"]})

    @app.get("/content")
    def content():
        return jsonify({"lessons": teacher.as_json()["categories"], "greetings": admin_content.greetings()})

    # --------------------------------------------------------------- admin
    def admin_required():
        if not config.ADMIN_PASSWORD:
            abort(403, description="The Admin page is switched off. Set ADMIN_PASSWORD in the backend's .env and restart.")
        given = request.headers.get("X-Admin-Password", "")
        if not hmac.compare_digest(given.encode("utf-8"), config.ADMIN_PASSWORD.encode("utf-8")):
            time.sleep(0.4)  # slows password guessing
            abort(401, description="Wrong admin password.")

    def reload_all():
        dictionary.reload_lexicon(feedback)
        teacher.reload(feedback)

    @app.post("/admin/login")
    def admin_login():
        admin_required()
        return jsonify({"ok": True})

    @app.get("/admin/overview")
    def admin_overview():
        admin_required()
        return jsonify({
            "feedback": feedback.counts(),
            "lexicon_entries": len(dictionary.entries),
            "lesson_categories": len(teacher.categories),
            "lesson_items": sum(len(c["items"]) for c in teacher.categories),
            "corpus_sentences": len(dictionary.sentences),
            "tts": tts.status(),
            "asr": asr.status(),
            "voice_conversion": voices.status(),
            "llm": llm.available(),
            "training_file": (str(TRAINING_FILE.relative_to(config.BASE_DIR)) if TRAINING_FILE.is_relative_to(config.BASE_DIR)
                              else str(TRAINING_FILE)),
        })

    @app.get("/admin/feedback")
    def admin_feedback():
        admin_required()
        return jsonify({"items": feedback.list(request.args.get("status") or None), "counts": feedback.counts()})

    @app.post("/admin/feedback/<rid>")
    def admin_review(rid):
        admin_required()
        data = body()
        try:
            r = feedback.review(rid, data.get("action"), final=data.get("final"), note=data.get("note"))
        except KeyError:
            abort(404)
        except ValueError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        if data.get("action") in ("approve", "reopen"):
            reload_all()
        return jsonify({"ok": True, "item": r, "counts": feedback.counts()})

    @app.get("/admin/content/<name>")
    def admin_get(name):
        admin_required()
        if name not in admin_content.FILES:
            abort(404)
        return jsonify(admin_content.read(name))

    @app.put("/admin/content/<name>")
    def admin_put(name):
        admin_required()
        if name not in admin_content.FILES:
            abort(404)
        data = request.get_json(silent=True)
        try:
            if name == "corrections":
                feedback.set_corrections((data or {}).get("items") or [])
            else:
                admin_content.save(name, data)
        except admin_content.Invalid as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        reload_all()
        return jsonify({"ok": True, "data": admin_content.read(name)})

    @app.get("/admin/backups/<name>")
    def admin_backups(name):
        admin_required()
        if name not in admin_content.FILES:
            abort(404)
        return jsonify({"items": backups(admin_content.FILES[name].stem)})

    @app.post("/admin/restore/<name>")
    def admin_restore(name):
        admin_required()
        if name not in admin_content.FILES:
            abort(404)
        file = body().get("backup") or ""
        src = BACKUP_DIR / file
        if "/" in file or "\\" in file or not file.startswith(admin_content.FILES[name].stem + ".") or not src.exists():
            abort(400, description="Unknown backup")
        from modules.store import read_json, write_json
        write_json(admin_content.FILES[name], read_json(src))
        if name == "corrections":
            feedback.corrections = read_json(admin_content.FILES[name], []) or []
        reload_all()
        return jsonify({"ok": True, "data": admin_content.read(name)})

    @app.get("/admin/export/corrections")
    def admin_export():
        admin_required()
        text = TRAINING_FILE.read_text(encoding="utf-8") if TRAINING_FILE.exists() else "kind\tinput\twrong_tulu\ttulu\troman\tenglish\tapproved\n"
        return Response(text, mimetype="text/tab-separated-values",
                        headers={"Content-Disposition": "attachment; filename=tulu-mitra-corrections.tsv"})

    # -------------------------------------------------- lessons and quiz
    @app.get("/lessons")
    def lessons():
        return jsonify(teacher.as_json())

    @app.post("/learn")
    def learn():
        idx = teacher.category_index(body().get("category", ""))
        return jsonify(teacher.lesson(idx if idx is not None else 0) or {})

    @app.post("/quiz")
    def quiz():
        data = body()
        return jsonify(teacher.question(data.get("kind", "words"), teacher.category_index(data.get("category", ""))))

    # ------------------------------------------------------------- errors
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": getattr(e, "description", "Bad request")}), 400

    @app.errorhandler(401)
    def unauthorised(e):
        return jsonify({"error": getattr(e, "description", "Not allowed")}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": getattr(e, "description", "Not allowed")}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": f"File too large (max {config.MAX_UPLOAD_MB} MB)"}), 413

    @app.errorhandler(500)
    def server_error(e):
        log.exception("Server error")
        return jsonify({"error": "Something went wrong on the server"}), 500

    log.info("Tulu Mitra API ready — LLM %s, ASR %s, TTS %s",
             "on" if llm.available() else "off", asr.status()["state"], tts.status()["state"])
    return app


app = create_app()

if __name__ == "__main__":
    import os

    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")), debug=False)
