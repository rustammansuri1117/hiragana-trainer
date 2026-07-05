"""
main.py
-------
FastAPI backend for the Hiragana Trainer app.

Endpoints
---------
GET  /api/character   -> returns one random hiragana character
POST /api/check       -> validates a submitted romaji answer
GET  /api/all         -> returns the full hiragana dataset

Run with:
    uvicorn main:app --reload --port 8000
"""

import random

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    HIRAGANA_DATA,
    CheckAnswerRequest,
    CheckAnswerResponse,
    CharacterResponse,
    get_answer_for_char,
)

app = FastAPI(
    title="Hiragana Trainer API",
    description="A lightweight API that powers a hiragana flashcard/quiz trainer.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS - the frontend is served from a different origin (e.g. a static file
# server on :5500 or opened directly as a file), so allow all origins for
# this local learning-tool project.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
def root():
    """Simple health-check / welcome route."""
    return {"message": "Hiragana Trainer API is running", "docs": "/docs"}


@app.get("/api/character", response_model=CharacterResponse, tags=["quiz"])
def get_random_character():
    """Return one random hiragana character for the user to answer."""
    item = random.choice(HIRAGANA_DATA)
    return {"char": item["char"]}


@app.post("/api/check", response_model=CheckAnswerResponse, tags=["quiz"])
def check_answer(payload: CheckAnswerRequest):
    """
    Validate the user's romaji answer against the correct reading.

    Answer checking is case-insensitive and trims surrounding whitespace,
    so " Sa ", "sa", and "SA" are all accepted as correct for "さ".
    """
    correct_answer = get_answer_for_char(payload.char)

    if correct_answer is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown hiragana character: {payload.char!r}",
        )

    user_answer = payload.answer.strip().lower()
    is_correct = user_answer == correct_answer.lower()

    return {"correct": is_correct, "correct_answer": correct_answer}


@app.get("/api/all", tags=["quiz"])
def get_all_characters():
    """Return the complete list of the 46 basic hiragana characters."""
    return {"count": len(HIRAGANA_DATA), "data": HIRAGANA_DATA}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
