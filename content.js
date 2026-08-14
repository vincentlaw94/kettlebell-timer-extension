// content.js
// State machine + timer driving the carousel (spec §5). Persists on every
// phase transition (not every tick) to chrome.storage.session so a round
// transition's full page navigation (§6) can pick up mid-workout.

(function () {
  const STORAGE_KEY = 'kbState';
  const DEFAULT_CONFIG = { rounds: 3, workSeconds: 30, restSeconds: 30, totalExercises: 6 };

  let state = null;
  let tickHandle = null;
  let audioCtx = null;

  function baseUrl() {
    return `${location.origin}${location.pathname}`;
  }

  // Web Audio needs a real user gesture to unlock playback; call this from
  // click/keydown handlers so ticks (not gestures) can still play a beep later.
  function unlockAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  }

  const BEEP_COUNT = 3;
  const BEEP_GAP_MS = 80;

  function beepDurationMs(toneMs) {
    return BEEP_COUNT * toneMs + (BEEP_COUNT - 1) * BEEP_GAP_MS;
  }

  function beep(freq = 880, toneMs = 120) {
    try {
      unlockAudio();
      const ctx = audioCtx;
      for (let i = 0; i < BEEP_COUNT; i++) {
        const startAt = ctx.currentTime + (i * (toneMs + BEEP_GAP_MS)) / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + toneMs / 1000);
        osc.connect(gain).connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + toneMs / 1000);
      }
    } catch (e) {
      // Audio unavailable/blocked — non-fatal, the timer still runs.
    }
  }

  function saveState(next) {
    state = next;
    chrome.storage.session.set({ [STORAGE_KEY]: state });
  }

  function clearState() {
    state = null;
    chrome.storage.session.remove(STORAGE_KEY);
  }

  function startTicking() {
    stopTicking();
    tickHandle = setInterval(tick, 250);
  }

  function stopTicking() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
  }

  function startWorkout(config) {
    unlockAudio(); // click is a genuine user gesture — unlocks playback for later ticks
    saveState({
      active: true,
      round: 1,
      exercise: 1,
      phase: 'work',
      isPaused: false,
      phaseEndsAt: Date.now() + config.workSeconds * 1000,
      pausedRemainingMs: null,
      hasMoreRounds: null,
      config,
    });
    render();
    startTicking();
  }

  function stopWorkout() {
    stopTicking();
    clearState();
    render();
  }

  function togglePause() {
    if (!state || !state.active || state.phase === 'done') return;
    if (state.isPaused) {
      saveState({
        ...state,
        isPaused: false,
        phaseEndsAt: Date.now() + state.pausedRemainingMs,
        pausedRemainingMs: null,
      });
      startTicking();
    } else {
      stopTicking();
      saveState({
        ...state,
        isPaused: true,
        pausedRemainingMs: Math.max(0, state.phaseEndsAt - Date.now()),
        phaseEndsAt: null,
      });
    }
    render();
  }

  // Advances phase/round/exercise. Deviates from spec §5/§6 at the user's
  // request: the round-transition redirect fires as soon as the round's
  // last exercise ends, so rest is spent already on the next round's first
  // slide — not on the last slide of the round that just finished.
  function advancePhase() {
    const { config } = state;
    if (state.phase === 'work') {
      if (state.exercise < config.totalExercises) {
        beep();
        KBSelectors.clickNext();
        saveState({
          ...state,
          exercise: state.exercise + 1,
          phaseEndsAt: Date.now() + config.workSeconds * 1000,
        });
        render();
        return;
      }
      // Round's last exercise just finished. Decide now whether another
      // round follows, so the round counter already reflects what's about
      // to be on screen and rest-end doesn't have to re-derive it.
      const hasMoreRounds = state.round < config.rounds;
      beep();
      saveState({
        ...state,
        round: hasMoreRounds ? state.round + 1 : state.round,
        exercise: 1,
        phase: 'roundRest',
        hasMoreRounds,
        phaseEndsAt: Date.now() + config.restSeconds * 1000,
      });
      if (hasMoreRounds) {
        const delay = beepDurationMs(120) + 50;
        const dest = `${baseUrl()}?img_index=1`;
        // Delay the navigation until the triplet finishes so it isn't cut off
        // by the page teardown (this is a real page load, not a soft update).
        setTimeout(() => {
          location.href = dest;
        }, delay);
        return; // navigation tears down this context; next load resumes the rest countdown
      }
      // Last round finished — cool-down rest on the final slide, no navigation.
    } else if (state.phase === 'roundRest') {
      if (state.hasMoreRounds) {
        beep();
        saveState({
          ...state,
          phase: 'work',
          phaseEndsAt: Date.now() + config.workSeconds * 1000,
        });
      } else {
        beep(440, 180);
        stopTicking();
        saveState({ ...state, phase: 'done', phaseEndsAt: null });
      }
    }
    render();
  }

  function tick() {
    if (!state || !state.active || state.isPaused || state.phase === 'done') return;
    if (state.phaseEndsAt - Date.now() <= 0) {
      advancePhase();
    } else {
      render();
    }
  }

  function render() {
    if (!state || !state.active) {
      KBOverlay.showIdle(DEFAULT_CONFIG, startWorkout);
      return;
    }
    if (state.phase === 'done') {
      KBOverlay.showDone();
      return;
    }
    const remainingMs = state.isPaused
      ? state.pausedRemainingMs
      : Math.max(0, state.phaseEndsAt - Date.now());
    const payload = {
      phase: state.phase,
      round: state.round,
      rounds: state.config.rounds,
      exercise: state.exercise,
      totalExercises: state.config.totalExercises,
      hasMoreRounds: state.hasMoreRounds,
      remainingMs,
    };
    if (state.isPaused) {
      KBOverlay.showPaused(payload);
    } else {
      KBOverlay.showActive(payload);
    }
  }

  function onKeydown(e) {
    if (!state || !state.active) return;
    if (e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      unlockAudio(); // keydown is a genuine user gesture — re-unlocks audio after a round-transition reload
      togglePause();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopWorkout();
    }
  }

  function init() {
    // Capture phase + preventDefault so Instagram's own Space-to-play/pause
    // binding on the visible video doesn't win the race (spec §9).
    document.addEventListener('keydown', onKeydown, true);
    chrome.storage.session.get(STORAGE_KEY, (result) => {
      const saved = result[STORAGE_KEY];
      if (saved && saved.active) {
        state = saved;
        render();
        if (!state.isPaused && state.phase !== 'done') startTicking();
      } else {
        render();
      }
    });
  }

  init();
})();
