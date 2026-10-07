# ತುಳು ಮಿತ್ರ · Tulu Mitra — start here

Three pieces:

| File | What it is | Needs |
|---|---|---|
| `tulu-mitra-preview.html` | the whole website in one file, running on built-in demo data (incl. a compact index of your corpus) | just double-click it |
| `tulu-mitra-frontend/` | the React website (source) | Node.js 18+ |
| `tulu-mitra-backend/` | the Flask API, the cleaned corpus, and the training pipeline | Python 3.10+, ffmpeg |

## A. Show the demo (no setup)
Open `tulu-mitra-preview.html` in Chrome or Edge. Everything works offline;
the chat sidebar says **Demo mode**.

## B. Run the website locally (demo data)
```bash
cd tulu-mitra-frontend
npm install
npm run dev              # → http://localhost:5173
```

## C. Run website + backend together
Terminal 1 — backend:
```bash
cd tulu-mitra-backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env
python app.py                     # → http://localhost:8000/health
```
Terminal 2 — frontend: create `tulu-mitra-frontend/.env` containing
```
VITE_API_URL=http://localhost:8000
```
then `npm run dev`. The chat sidebar now says **Connected to backend**.

## D. Speech, training, going live
- Speech models: `pip install -r requirements-ml.txt` in the backend.
- Train on your recordings: `tulu-mitra-backend/training/README.md` (Colab notebook included).
- Put it online: "Make it live" in `tulu-mitra-backend/README.md`
  (backend → Hugging Face Spaces, frontend → Vercel).
