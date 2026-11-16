TuluMitra – Project Information

Project Title:
AI-Powered Multilingual Voice Assistant for Regional Language Learning and Personalized Voice Interaction

Team Members:
1. Name: Abhishek Nayak | USN: 4CB23AI008
2. Name: Nihal         | USN: 4CB23AI059

Software Requirements:
* Python: 3.10 or higher (developed on 3.10; the Docker image uses 3.11)
* Node.js: v20.19 
* Visual Studio Code
* Git
* Flask (3.0 or newer)
* React 19 and Vite 8 (with React Router 7)
* ffmpeg (needed for the speech features)

Software Download Links:
* Python:  https://www.python.org/
* Node.js: https://nodejs.org/
* VS Code: https://code.visualstudio.com/
* Git:     https://git-scm.com/
* ffmpeg:  https://ffmpeg.org/

Dataset Used:
Tulu text corpus (73,872 cleaned sentences) and Tulu speech recordings with
corresponding transcripts.
Generated Dataset Details:
* Total audio recordings: 157
* Total transcripts: 157
* Sampling rate: 16000 Hz
* Training samples: 125
* Validation samples: 16
* Testing samples: 16

Execution Instructions:
Backend:
1. Navigate to the backend directory:  cd tulu-mitra-backend
2. Create and activate a virtual environment:
   python -m venv .venv
   Windows: .venv\Scripts\activate 
3. Install requirements:  pip install -r requirements.txt
   (optional, for the speech models: pip install -r requirements-ml.txt)
4. Configure environment variables: copy .env.example to .env and edit it.
5. Run:  python app.py        (the backend runs at http://localhost:8000)

Frontend:
1. Navigate to the frontend directory:  cd tulu-mitra-frontend
2. Run:  npm ci
3. Create a .env file with VITE_API_URL=http://localhost:8000 to connect to the
   backend (without it the app runs on demo data).
4. Run:  npm run dev
5. Open the displayed local URL (http://localhost:5173) in a browser.

GitHub Repository:
https://github.com/Nihaljkanchan/TuluMitra

AIL06 System Number: [fill this in yourself]