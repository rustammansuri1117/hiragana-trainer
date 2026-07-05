# 平がな Hiragana Trainer

A full-stack flashcard + quiz trainer for the 46 basic Japanese hiragana
characters. FastAPI serves a small validation API; a dependency-free
HTML/CSS/JS frontend renders an ink-and-seal ("hanko stamp") themed
flashcard experience with score tracking, streaks, a mistake-review deck,
optional 10-second timer mode, and progress saved locally in the browser.

```
hiragana-trainer/
├── backend/
│   ├── main.py            # FastAPI app + routes
│   ├── models.py          # Pydantic schemas + the hiragana dataset
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

---

## 1. Run the backend (FastAPI)

Requires Python 3.9+.

```bash
cd hiragana-trainer/backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API is now live at **http://localhost:8000**. Interactive docs (Swagger
UI) are automatically available at **http://localhost:8000/docs**.

### API reference

| Method | Route            | Description                                   |
|--------|------------------|------------------------------------------------|
| GET    | `/api/character` | Returns one random hiragana character, e.g. `{ "char": "さ" }` |
| POST   | `/api/check`      | Validates an answer. Body: `{ "char": "さ", "answer": "sa" }` → `{ "correct": true, "correct_answer": "sa" }` |
| GET    | `/api/all`        | Returns the full 46-character dataset |

Answer checking is case-insensitive and trims whitespace (`" Sa "`, `"sa"`,
and `"SA"` all match `さ`).

---

## 2. Run the frontend

The frontend is plain static HTML/CSS/JS — no build step. Any static file
server works. Two easy options:

**Option A — Python's built-in server**

```bash
cd hiragana-trainer/frontend
python3 -m http.server 5500
```

Then open **http://localhost:5500** in your browser.

**Option B — just open the file**

Double-click `frontend/index.html` (or open it via `File → Open` in your
browser). Since the app talks to `http://localhost:8000` explicitly via
`fetch()`, and the backend has CORS enabled for all origins, this works
even when the page is loaded as a local `file://` URL.

> Either way, make sure the backend from step 1 is running first — the
> frontend fetches its first character from it on page load.

---

## 3. How it works

- **Flashcard loop** — on load and after every answer, the frontend asks
  the backend for a character and renders it in large serif type on a
  "washi paper" card.
- **Answer checking** — every submission is validated server-side via
  `POST /api/check`; the frontend never grades answers itself.
- **Instant feedback** — a correct answer stamps a red hanko seal onto the
  card; a wrong answer shakes the card and reveals the correct romaji.
- **Score panel** — live counts of correct / missed / total attempts and
  accuracy percentage, plus a current and best streak counter.
- **Mistake review deck** — every missed character is logged with a miss
  count and shown in a dedicated panel, sorted by how often it's been
  missed.
- **Lightweight spaced repetition** — once you have logged mistakes, ~40%
  of subsequent cards are drawn from your mistake list (weighted toward
  characters you've missed more), instead of a fresh random pull from the
  backend — so trouble characters resurface more often.
- **Timer mode** — flip the "10s Timer Mode" switch to add a countdown
  ring to each card; running out of time auto-submits as a miss.
- **Session history strip** — a compact strip of colored marks (green =
  correct, red = wrong) showing your most recent answers at a glance.
- **Persistence** — score, streak, mistakes, and history are saved to
  `localStorage`, so closing and reopening the tab resumes where you left
  off. "Restart Session" clears current progress but keeps your all-time
  best streak.

---

## 4. Notes on extending it

- The dataset lives in `backend/models.py` — add dakuten (がぎぐ…) or
  combination kana (きゃ, しゅ, ちょ…) by extending `HIRAGANA_DATA`.
- The frontend never assumes a fixed dataset size beyond display copy
  ("X / 46 seen"), so adding characters to the backend is safe.
- All colors/typography are driven by CSS custom properties at the top of
  `style.css` (`:root`), so re-theming (e.g. for katakana mode) is a
  matter of swapping tokens.
