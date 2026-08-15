// overlay.js
// Single injected Shadow-DOM HUD (spec §7). Idle state shows editable
// config + Start; Active state shows the countdown, phase, and hints.
// A separate full-viewport scrim (visible only during rest) reinforces
// "not working right now" without hiding the HUD box itself.

const KBOverlay = (() => {
  let shadow = null;
  let els = {};

  function ensureMounted() {
    if (shadow) return;
    const host = document.createElement('div');
    host.id = 'kb-timer-host';
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('overlay.css');
    shadow.appendChild(link);

    const scrim = document.createElement('div');
    scrim.id = 'kb-scrim';
    shadow.appendChild(scrim);
    els.scrim = scrim;

    const root = document.createElement('div');
    root.id = 'kb-root';
    shadow.appendChild(root);
    els.root = root;
  }

  function setScrim(visible) {
    els.scrim.classList.toggle('kb-scrim-visible', !!visible);
  }

  function fmtTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  }

  // Elapsed time (not a countdown) — round to the nearest second rather
  // than always rounding up.
  function fmtElapsed(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  }

  function showIdle(config, onStart) {
    ensureMounted();
    setScrim(false);
    els.root.className = 'kb-box kb-idle';
    els.root.innerHTML = `
      <div class="kb-title">Kettlebell Timer</div>
      <label>Rounds <input type="number" id="kb-rounds" min="1" value="${config.rounds}"></label>
      <label>Work (s) <input type="number" id="kb-work" min="1" value="${config.workSeconds}"></label>
      <label>Rest (s) <input type="number" id="kb-rest" min="1" value="${config.restSeconds}"></label>
      <label>Exercises <input type="number" id="kb-total" min="1" value="${config.totalExercises}"></label>
      <button id="kb-start">Start</button>
    `;
    els.root.querySelector('#kb-start').addEventListener('click', () => {
      onStart({
        rounds: parseInt(els.root.querySelector('#kb-rounds').value, 10) || 1,
        workSeconds: parseInt(els.root.querySelector('#kb-work').value, 10) || 1,
        restSeconds: parseInt(els.root.querySelector('#kb-rest').value, 10) || 1,
        totalExercises: parseInt(els.root.querySelector('#kb-total').value, 10) || 1,
      });
    });
  }

  function restLabel(hasMoreRounds) {
    return hasMoreRounds ? 'Resting for next round' : 'Round complete';
  }

  function showActive({ phase, round, rounds, exercise, totalExercises, hasMoreRounds, remainingMs }) {
    ensureMounted();
    const isRest = phase === 'roundRest';
    setScrim(isRest);
    els.root.className = `kb-box kb-active ${isRest ? 'kb-rest' : 'kb-work'}`;
    els.root.innerHTML = `
      <div class="kb-phase">${isRest ? 'REST' : 'WORK'}</div>
      <div class="kb-meta">Round ${round} / ${rounds}</div>
      <div class="kb-meta">${isRest ? restLabel(hasMoreRounds) : `Exercise ${exercise} / ${totalExercises}`}</div>
      <div class="kb-countdown">${fmtTime(remainingMs)}</div>
      <div class="kb-hint">Space to pause &middot; Esc to stop</div>
    `;
  }

  function showPaused({ phase, round, rounds, exercise, totalExercises, hasMoreRounds, remainingMs }) {
    ensureMounted();
    setScrim(phase === 'roundRest');
    els.root.className = 'kb-box kb-active kb-paused';
    els.root.innerHTML = `
      <div class="kb-phase">PAUSED</div>
      <div class="kb-meta">Round ${round} / ${rounds}</div>
      <div class="kb-meta">${phase === 'roundRest' ? restLabel(hasMoreRounds) : `Exercise ${exercise} / ${totalExercises}`}</div>
      <div class="kb-countdown">${fmtTime(remainingMs)}</div>
      <div class="kb-hint">Space to resume &middot; Esc to stop</div>
    `;
  }

  function showDone(totalElapsedMs) {
    ensureMounted();
    setScrim(false);
    els.root.className = 'kb-box kb-active kb-done';
    els.root.innerHTML = `
      <div class="kb-phase">DONE</div>
      <div class="kb-meta">Total time</div>
      <div class="kb-countdown">${fmtElapsed(totalElapsedMs)}</div>
      <div class="kb-hint">Esc to reset</div>
    `;
  }

  return { showIdle, showActive, showPaused, showDone };
})();
