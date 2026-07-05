"""
models.py
---------
Data models and the core Hiragana dataset used by the API.

Kept separate from main.py so the dataset / schema definitions
are easy to find, extend (e.g. add dakuten characters, digraphs)
and unit-test independently of the web layer.
"""

from pydantic import BaseModel


class CheckAnswerRequest(BaseModel):
    """Payload sent by the frontend when the user submits an answer."""
    char: str
    answer: str


class CheckAnswerResponse(BaseModel):
    """Payload returned after validating the user's answer."""
    correct: bool
    correct_answer: str


class CharacterResponse(BaseModel):
    """A single hiragana character sent to the frontend for practice."""
    char: str


# ---------------------------------------------------------------------------
# The 46 basic (gojūon) Hiragana characters and their romaji readings.
# ---------------------------------------------------------------------------
HIRAGANA_DATA = [
    {"char": "あ", "answer": "a"},
    {"char": "い", "answer": "i"},
    {"char": "う", "answer": "u"},
    {"char": "え", "answer": "e"},
    {"char": "お", "answer": "o"},

    {"char": "か", "answer": "ka"},
    {"char": "き", "answer": "ki"},
    {"char": "く", "answer": "ku"},
    {"char": "け", "answer": "ke"},
    {"char": "こ", "answer": "ko"},

    {"char": "さ", "answer": "sa"},
    {"char": "し", "answer": "shi"},
    {"char": "す", "answer": "su"},
    {"char": "せ", "answer": "se"},
    {"char": "そ", "answer": "so"},

    {"char": "た", "answer": "ta"},
    {"char": "ち", "answer": "chi"},
    {"char": "つ", "answer": "tsu"},
    {"char": "て", "answer": "te"},
    {"char": "と", "answer": "to"},

    {"char": "な", "answer": "na"},
    {"char": "に", "answer": "ni"},
    {"char": "ぬ", "answer": "nu"},
    {"char": "ね", "answer": "ne"},
    {"char": "の", "answer": "no"},

    {"char": "は", "answer": "ha"},
    {"char": "ひ", "answer": "hi"},
    {"char": "ふ", "answer": "fu"},
    {"char": "へ", "answer": "he"},
    {"char": "ほ", "answer": "ho"},

    {"char": "ま", "answer": "ma"},
    {"char": "み", "answer": "mi"},
    {"char": "む", "answer": "mu"},
    {"char": "め", "answer": "me"},
    {"char": "も", "answer": "mo"},

    {"char": "や", "answer": "ya"},
    {"char": "ゆ", "answer": "yu"},
    {"char": "よ", "answer": "yo"},

    {"char": "ら", "answer": "ra"},
    {"char": "り", "answer": "ri"},
    {"char": "る", "answer": "ru"},
    {"char": "れ", "answer": "re"},
    {"char": "ろ", "answer": "ro"},

    {"char": "わ", "answer": "wa"},
    {"char": "を", "answer": "wo"},

    {"char": "ん", "answer": "n"},
]


def get_answer_for_char(char: str) -> str | None:
    """Look up the correct romaji answer for a given hiragana character."""
    for item in HIRAGANA_DATA:
        if item["char"] == char:
            return item["answer"]
    return None
