/* ==========================================================================
   Hiragana Trainer — script.js
   Handles: API communication, score/streak tracking, mistake-weighted
   ("spaced repetition") character selection, optional 10s timer mode,
   and localStorage persistence across sessions.
   ========================================================================== */

const API_BASE = "https://hiragana-trainer-1.onrender.com";

/* ---------------------------------------------------------------------- */
/* DOM references                                                         */
/* ---------------------------------------------------------------------- */

const kanaCharEl   = document.getElementById("kanaChar");
const charIndexEl  = document.getElementById("charIndex");
const washiCardEl  = document.getElementById("washiCard");
const hankoStampEl = document.getElementById("hankoStamp");

const answerForm   = document.getElementById("answerForm");
const answerInput  = document.getElementById("answerInput");
const submitBtn    = document.getElementById("submitBtn");
const nextBtn      = document.getElementById("nextBtn");
const restartBtn   = document.getElementById("restartBtn");
const feedbackEl   = document.getElementById("feedback");

const correctCountEl  = document.getElementById("correctCount");
const wrongCountEl    = document.getElementById("wrongCount");
const totalCountEl    = document.getElementById("totalCount");
const accuracyValueEl = document.getElementById("accuracyValue");
const accuracyBarEl   = document.getElementById("accuracyBar");

const streakCountEl = document.getElementById("streakCount");
const streakFlameEl = document.getElementById("streakFlame");
const bestStreakEl  = document.getElementById("bestStreak");

const mistakeListEl  = document.getElementById("mistakeList");
const mistakeEmptyEl = document.getElementById("mistakeEmpty");
const historyTrackEl = document.getElementById("historyTrack");

const timerToggle  = document.getElementById("timerToggle");
const timerRingEl  = document.getElementById("timerRing");
const timerRingFg  = document.getElementById("timerRingFg");
const timerTextEl  = document.getElementById("timerText");

/* ---------------------------------------------------------------------- */
/* State                                                                   */
/* ---------------------------------------------------------------------- */

const STORAGE_KEY = "hiraganaTrainerState";
const RING_CIRCUMFERENCE = 213.6; // 2 * PI * r(34), matches CSS
const TIMER_SECONDS = 10;
const HISTORY_LIMIT = 80;

let allCharacters = [];      // [{char, answer}, ...] fetched once from /api/all
let seenChars = new Set();   // characters shown at least once this session

let state = {
  correct: 0,
  wrong: 0,
  total: 0,
  streak: 0,
  bestStreak: 0,
  mistakes: {},   // { "さ": { answer: "sa", count: 2 } }
  history: [],    // ["correct", "wrong", ...]
};

let currentChar = null;
let awaitingNext = false;   // true while feedback is showing, before auto-advance
let advanceTimeout = null;
let timerInterval = null;
let timeRemaining = TIMER_SECONDS;

/* ---------------------------------------------------------------------- */
/* Persistence                                                            */
/* ---------------------------------------------------------------------- */

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Could not save progress to localStorage:", err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    }
  } catch (err) {
    console.warn("Could not load saved progress:", err);
  }
}

/* ---------------------------------------------------------------------- */
/* Rendering                                                               */
/* ---------------------------------------------------------------------- */

function renderStats() {
  correctCountEl.textContent = state.correct;
  wrongCountEl.textContent = state.wrong;
  totalCountEl.textContent = state.total;

  const accuracy = state.total > 0
    ? Math.round((state.correct / state.total) * 100)
    : 0;
  accuracyValueEl.textContent = `${accuracy}%`;
  accuracyBarEl.style.width = `${accuracy}%`;

  streakCountEl.textContent = state.streak;
  bestStreakEl.textContent = state.bestStreak;
  streakFlameEl.classList.toggle("lit", state.streak >= 3);

  charIndexEl.textContent = `${seenChars.size} / ${allCharacters.length || 46} seen`;
}

function renderMistakes() {
  const entries = Object.entries(state.mistakes)
    .sort((a, b) => b[1].count - a[1].count);

  mistakeListEl.querySelectorAll(".mistake-item").forEach(el => el.remove());

  if (entries.length === 0) {
    mistakeEmptyEl.style.display = "block";
    return;
  }
  mistakeEmptyEl.style.display = "none";

  for (const [char, info] of entries) {
    const li = document.createElement("li");
    li.className = "mistake-item";
    li.innerHTML = `
      <span class="mistake-char">${char}</span>
      <div class="mistake-meta">
        <span class="mistake-answer">${info.answer}</span>
        <span class="mistake-count">missed ×${info.count}</span>
      </div>
    `;
    mistakeListEl.appendChild(li);
  }
}

function renderHistory() {
  historyTrackEl.innerHTML = "";
  const recent = state.history.slice(-HISTORY_LIMIT);
  for (const result of recent) {
    const mark = document.createElement("span");
    mark.className = `history-mark ${result}`;
    historyTrackEl.appendChild(mark);
  }
}

function renderAll() {
  renderStats();
  renderMistakes();
  renderHistory();
}

/* ---------------------------------------------------------------------- */
/* Timer mode (10s per question)                                          */
/* ---------------------------------------------------------------------- */

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();
  timeRemaining = TIMER_SECONDS;
  timerTextEl.textContent = timeRemaining;
  timerRingFg.style.strokeDashoffset = "0";

  timerInterval = setInterval(() => {
    timeRemaining -= 1;
    timerTextEl.textContent = Math.max(timeRemaining, 0);
    const offset = RING_CIRCUMFERENCE * (1 - timeRemaining / TIMER_SECONDS);
    timerRingFg.style.strokeDashoffset = String(offset);

    if (timeRemaining <= 0) {
      stopTimer();
      if (!awaitingNext) {
        submitAnswer(true /* timedOut */);
      }
    }
  }, 1000);
}

/* ---------------------------------------------------------------------- */
/* Character selection (random + mistake-weighted "spaced repetition")    */
/* ---------------------------------------------------------------------- */

/**
 * Picks the next character. Most of the time we ask the backend for a
 * genuinely random character. But once the learner has a few mistakes on
 * record, there's a weighted chance we instead resurface a character
 * they've missed more often — a lightweight spaced-repetition effect
 * that still runs every answer through the real backend validator.
 */
async function pickNextCharacter() {
  const mistakeEntries = Object.entries(state.mistakes);
  const shouldReviewMistake = mistakeEntries.length > 0 && Math.random() < 0.4;

  if (shouldReviewMistake) {
    const weighted = [];
    for (const [char, info] of mistakeEntries) {
      for (let i = 0; i < info.count; i++) weighted.push(char);
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  const res = await fetch(`${API_BASE}/api/character`);
  if (!res.ok) throw new Error("Failed to fetch character");
  const data = await res.json();
  return data.char;
}

async function loadNextCharacter() {
  clearTimeout(advanceTimeout);
  stopTimer();
  awaitingNext = false;

  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  hankoStampEl.classList.remove("stamped");
  washiCardEl.classList.remove("shake", "pop");
  answerInput.value = "";
  answerInput.disabled = false;
  submitBtn.disabled = false;

  try {
    currentChar = await pickNextCharacter();
    kanaCharEl.textContent = currentChar;
    seenChars.add(currentChar);
    renderStats();
    answerInput.focus();

    if (timerToggle.checked) {
      timerRingEl.hidden = false;
      startTimer();
    } else {
      timerRingEl.hidden = true;
    }
  } catch (err) {
    feedbackEl.textContent = "⚠ Could not reach the backend. Is FastAPI running on :8000?";
    feedbackEl.className = "feedback wrong";
    console.error(err);
  }
}

/* ---------------------------------------------------------------------- */
/* Answer submission                                                      */
/* ---------------------------------------------------------------------- */

async function submitAnswer(timedOut = false) {
  if (awaitingNext || !currentChar) return;

  const userAnswer = timedOut ? "" : answerInput.value.trim();
  if (!timedOut && userAnswer === "") return;

  awaitingNext = true;
  stopTimer();
  answerInput.disabled = true;
  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ char: currentChar, answer: userAnswer }),
    });

    if (!res.ok) throw new Error("Backend rejected the request");
    const result = await res.json();

    state.total += 1;

    if (result.correct) {
      state.correct += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.history.push("correct");

      // A correct rep on a previously-missed card lightens its weight.
      if (state.mistakes[currentChar]) {
        state.mistakes[currentChar].count = Math.max(0, state.mistakes[currentChar].count - 1);
        if (state.mistakes[currentChar].count === 0) delete state.mistakes[currentChar];
      }

      feedbackEl.textContent = `Correct! 「${currentChar}」 = ${result.correct_answer}`;
      feedbackEl.className = "feedback correct";
      washiCardEl.classList.add("pop");
      hankoStampEl.classList.add("stamped");
    } else {
      state.wrong += 1;
      state.streak = 0;
      state.history.push("wrong");

      if (!state.mistakes[currentChar]) {
        state.mistakes[currentChar] = { answer: result.correct_answer, count: 0 };
      }
      state.mistakes[currentChar].count += 1;

      const prefix = timedOut ? "⏱ Time's up." : "Not quite.";
      feedbackEl.textContent = `${prefix} 「${currentChar}」 = ${result.correct_answer}`;
      feedbackEl.className = "feedback wrong";
      washiCardEl.classList.add("shake");
    }

    if (state.history.length > HISTORY_LIMIT * 2) {
      state.history = state.history.slice(-HISTORY_LIMIT);
    }

    saveState();
    renderAll();

    advanceTimeout = setTimeout(loadNextCharacter, 1400);
  } catch (err) {
    feedbackEl.textContent = "⚠ Could not reach the backend. Is FastAPI running on :8000?";
    feedbackEl.className = "feedback wrong";
    answeringFailed();
    console.error(err);
  }
}

function answeringFailed() {
  awaitingNext = false;
  answerInput.disabled = false;
  submitBtn.disabled = false;
}

/* ---------------------------------------------------------------------- */
/* Restart session                                                        */
/* ---------------------------------------------------------------------- */

function restartSession() {
  clearTimeout(advanceTimeout);
  stopTimer();
  state = {
    correct: 0,
    wrong: 0,
    total: 0,
    streak: 0,
    bestStreak: state.bestStreak, // keep all-time best streak as a badge
    mistakes: {},
    history: [],
  };
  seenChars = new Set();
  saveState();
  renderAll();
  loadNextCharacter();
}

/* ---------------------------------------------------------------------- */
/* Event listeners                                                        */
/* ---------------------------------------------------------------------- */

answerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitAnswer(false);
});

nextBtn.addEventListener("click", () => {
  loadNextCharacter();
});

restartBtn.addEventListener("click", () => {
  if (confirm("Restart this session? Your all-time best streak will be kept, but current score and mistakes will reset.")) {
    restartSession();
  }
});

timerToggle.addEventListener("change", () => {
  if (!awaitingNext) {
    if (timerToggle.checked) {
      timerRingEl.hidden = false;
      startTimer();
    } else {
      timerRingEl.hidden = true;
      stopTimer();
    }
  }
});

/* ---------------------------------------------------------------------- */
/* Bootstrap                                                               */
/* ---------------------------------------------------------------------- */

async function init() {
  loadState();
  renderAll();

  try {
    const res = await fetch(`${API_BASE}/api/all`);
    if (res.ok) {
      const data = await res.json();
      allCharacters = data.data || [];
    }
  } catch (err) {
    console.warn("Could not preload full character set:", err);
  }

  renderStats();
  loadNextCharacter();
}

init();
