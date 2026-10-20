/**
 * GestikFit - Geführter Reha-Übungsbegleiter (Kamera-frei)
 * Entwickelt nach dem barrierearmen Muster von SchlaganfallFit.
 * Einfach, stressfrei, ohne technische Hürden.
 */

class GestikApp {
  constructor() {
    this.currentTab = 'start';

    // Aktiver Trainingslauf
    this.workout = {
      playlist: [],
      currentIndex: 0,
      currentStepIndex: 0,
      timer: null,
      secondsLeft: 0,
      totalSeconds: 0,
      isPaused: false,
      phase: 'prepare' // 'prepare', 'hold', 'feedback', 'summary'
    };
  }

  init() {
    this.initAccessibility();
    this.renderGesturesCatalogs();
    this.renderDiary();
    this.updateUIState();

    // Tastaturkürzel (Leertaste = Start/Weiter/Pause)
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' && this.currentTab === 'training') {
        e.preventDefault();
        this.handleSpaceKey();
      }
    });

    console.log('GestikFit (Kamera-frei) erfolgreich initialisiert.');
  }

  // =========================================================================
  // BARRIEREFREIHEIT & SETTINGS
  // =========================================================================

  initAccessibility() {
    const savedFontSize = localStorage.getItem('gestikfit_fontsize') || 'normal';
    this.setFontSize(savedFontSize);

    const savedContrast = localStorage.getItem('gestikfit_contrast') === 'true';
    if (savedContrast) {
      document.documentElement.classList.add('high-contrast');
    }

    const params = adaptiveManager.getCurrentParams();
    this.updateHandUI(params.handPreference);

    const caregiverCheckbox = document.getElementById('caregiver-mode-toggle');
    if (caregiverCheckbox) {
      caregiverCheckbox.checked = params.caregiverMode;
    }
  }

  setFontSize(size) {
    document.documentElement.classList.remove('font-size-normal', 'font-size-large', 'font-size-xlarge');
    document.documentElement.classList.add('font-size-' + size);
    localStorage.setItem('gestikfit_fontsize', size);

    ['normal', 'large', 'xlarge'].forEach(s => {
      const btn = document.getElementById('btn-font-' + s);
      if (btn) {
        if (s === size) {
          btn.classList.add('bg-teal-600', 'text-white');
          btn.classList.remove('text-slate-700');
        } else {
          btn.classList.remove('bg-teal-600', 'text-white');
          btn.classList.add('text-slate-700');
        }
      }
    });
  }

  toggleHighContrast() {
    const isHigh = document.documentElement.classList.toggle('high-contrast');
    localStorage.setItem('gestikfit_contrast', isHigh ? 'true' : 'false');
  }

  setHandPreference(hand) {
    adaptiveManager.setHandPreference(hand);
    this.updateHandUI(hand);
    appAudio.speak('Trainiere jetzt ' + (hand === 'links' ? 'linke Hand' : hand === 'rechts' ? 'rechte Hand' : 'beide Hände'));
    if (this.currentTab === 'training') {
      this.updatePlayerView();
    }
  }

  updateHandUI(hand) {
    ['links', 'rechts', 'beide'].forEach(h => {
      const btn = document.getElementById('btn-hand-' + h);
      if (btn) {
        if (h === hand) {
          btn.classList.add('bg-teal-600', 'text-white', 'shadow-sm');
          btn.classList.remove('bg-white', 'text-slate-700');
        } else {
          btn.classList.remove('bg-teal-600', 'text-white', 'shadow-sm');
          btn.classList.add('bg-white', 'text-slate-700');
        }
      }
    });

    const badge = document.getElementById('header-hand-badge');
    if (badge) {
      badge.textContent = hand === 'links' ? '✋ Linke Hand' : hand === 'rechts' ? '🤚 Rechte Hand' : '🤲 Beide Hände';
    }
  }

  toggleCaregiverMode() {
    const active = adaptiveManager.toggleCaregiverMode();
    const box = document.getElementById('player-caregiver-box');
    if (box) {
      box.classList.toggle('hidden', !active);
    }
    appAudio.speak(active ? 'Angehörigen-Modus aktiviert' : 'Angehörigen-Modus deaktiviert');
  }

  // =========================================================================
  // TAB NAVIGATION
  // =========================================================================

  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.add('hidden');
    });
    const target = document.getElementById('tab-' + tabId);
    if (target) {
      target.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('bg-teal-600', 'text-white');
        btn.classList.remove('text-slate-700', 'hover:bg-slate-200');
      } else {
        btn.classList.remove('bg-teal-600', 'text-white');
        btn.classList.add('text-slate-700', 'hover:bg-slate-200');
      }
    });

    if (tabId !== 'training' && this.workout.timer) {
      this.pauseTimer();
    }

    if (tabId === 'diary') {
      this.renderDiary();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // GESTEN-KATALOGE RENDERN
  // =========================================================================

  renderGesturesCatalogs() {
    const handContainer = document.getElementById('hand-gestures-grid');
    const armContainer = document.getElementById('arm-gestures-grid');

    if (handContainer) {
      const handGestures = GESTURES_DATA.filter(g => g.category === 'hand');
      handContainer.innerHTML = handGestures.map(g => this.createGestureCardHTML(g)).join('');
    }

    if (armContainer) {
      const armGestures = GESTURES_DATA.filter(g => g.category === 'arm');
      armContainer.innerHTML = armGestures.map(g => this.createGestureCardHTML(g)).join('');
    }
  }

  createGestureCardHTML(gesture) {
    const diffStars = '⭐'.repeat(gesture.schwierigkeit);
    return `
      <div class="bg-white rounded-3xl p-6 border-2 border-slate-200 hover:border-teal-500 transition-all shadow-sm hover:shadow-md flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center border border-teal-100 shrink-0">
              <span class="text-4xl" role="img" aria-label="${gesture.name}">${gesture.emoji}</span>
            </div>
            <div class="text-right">
              <span class="inline-block px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
                ${diffStars}
              </span>
            </div>
          </div>
          <h3 class="text-xl font-black text-slate-900 mb-1">${gesture.name}</h3>
          <p class="text-sm font-bold text-teal-700 mb-3">${gesture.kurzbeschreibung}</p>
          <div class="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs text-slate-600 mb-4 space-y-1">
            <p><strong>Reha-Wirkung:</strong> ${gesture.rehaNutzen}</p>
            <p><strong>Tipp:</strong> ${gesture.tippFuerAngehoerige}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button onclick="app.startSingleGesture('${gesture.id}')" class="btn-touch flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-base font-black shadow-md shadow-teal-600/20">
            Jetzt üben ▶️
          </button>
          <button onclick="appAudio.speak('${gesture.name}. ${gesture.kurzbeschreibung}. ${gesture.rehaNutzen}')" class="btn-touch p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl" title="Vorlesen">
            🔊
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // GEFÜHRTER REHA-TRAININGSPLAYER
  // =========================================================================

  startSingleGesture(gestureId) {
    const g = GESTURES_MAP[gestureId];
    if (!g) return;
    this.workout.playlist = [g];
    this.workout.currentIndex = 0;
    this.startWorkoutPlayer();
  }

  startDailyWorkout() {
    // 6 ausgewogene Gesten (4 Hände, 2 Arme)
    const dailyIds = ['daumen-hoch', 'offene-hand', 'peace', 'haende-hoch', 'ok-zeichen', 'haende-zusammen'];
    this.workout.playlist = dailyIds.map(id => GESTURES_MAP[id]).filter(Boolean);
    this.workout.currentIndex = 0;
    this.startWorkoutPlayer();
  }

  startHandWorkout() {
    // Alle 10 Handzeichen
    this.workout.playlist = GESTURES_DATA.filter(g => g.category === 'hand');
    this.workout.currentIndex = 0;
    this.startWorkoutPlayer();
  }

  startArmWorkout() {
    // Alle 5 Armbewegungen
    this.workout.playlist = GESTURES_DATA.filter(g => g.category === 'arm');
    this.workout.currentIndex = 0;
    this.startWorkoutPlayer();
  }

  startWorkoutPlayer() {
    this.switchTab('training');
    this.loadCurrentWorkoutExercise();
  }

  loadCurrentWorkoutExercise() {
    if (this.workout.currentIndex >= this.workout.playlist.length) {
      this.showSummaryView();
      return;
    }

    const currentExercise = this.workout.playlist[this.workout.currentIndex];
    this.workout.phase = 'prepare';
    this.workout.isPaused = false;
    this.clearWorkoutTimer();

    // UI auf Vorbereitungsphase schalten
    document.getElementById('player-prepare-view').classList.remove('hidden');
    document.getElementById('player-hold-view').classList.add('hidden');
    document.getElementById('player-feedback-view').classList.add('hidden');
    document.getElementById('player-summary-view').classList.add('hidden');

    this.updatePlayerView();

    // Audio-Ankündigung der Geste
    appAudio.playStartTone();
    appAudio.speak(`${currentExercise.name}. ${currentExercise.kurzbeschreibung}`);
  }

  updatePlayerView() {
    const ex = this.workout.playlist[this.workout.currentIndex];
    if (!ex) return;

    const params = adaptiveManager.getCurrentParams();
    const handWord = params.handPreference === 'links' ? 'linken' : params.handPreference === 'rechts' ? 'rechten' : 'beiden';

    // Header Counter & Titel
    document.getElementById('player-counter').textContent = `Übung ${this.workout.currentIndex + 1} von ${this.workout.playlist.length}`;
    document.getElementById('player-exercise-title').textContent = ex.name;
    document.getElementById('player-level-badge').textContent = `${params.levelName} · ${params.holdTime}s Haltezeit`;

    // Hand-Badge
    const handBadge = document.getElementById('player-target-hand-badge');
    if (handBadge) {
      handBadge.textContent = params.handPreference === 'links' ? '✋ Linke Hand' : params.handPreference === 'rechts' ? '🤚 Rechte Hand' : '🤲 Beide Hände';
    }

    // Großes Piktogramm
    const picBox = document.getElementById('player-pictogram');
    if (picBox) {
      picBox.innerHTML = `
        <div class="flex items-center gap-6">
          <div class="text-7xl sm:text-8xl">${ex.emoji}</div>
          <div>${ex.svgIcon}</div>
        </div>
      `;
    }

    // Schritte vorbereiten
    const stepsListEl = document.getElementById('player-steps-list');
    if (stepsListEl && ex.schritte) {
      stepsListEl.innerHTML = ex.schritte.map((step, idx) => {
        const text = step.replace(/\{HAND\}/g, handWord);
        return `
          <div class="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span class="w-7 h-7 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
              ${idx + 1}
            </span>
            <p class="text-base font-bold text-slate-800">${text}</p>
          </div>
        `;
      }).join('');
    }

    // Angehörigen-Tipp
    const careBox = document.getElementById('player-caregiver-box');
    const careText = document.getElementById('player-caregiver-text');
    if (careBox && careText) {
      careText.textContent = ex.tippFuerAngehoerige;
      careBox.classList.toggle('hidden', !params.caregiverMode);
    }

    // Reha-Nutzen
    const benefitEl = document.getElementById('player-benefit-text');
    if (benefitEl) {
      benefitEl.textContent = ex.rehaNutzen;
    }
  }

  // =========================================================================
  // HALTE-COUNTDOWN PHASE
  // =========================================================================

  startHoldingPhase() {
    this.workout.phase = 'hold';
    this.workout.isPaused = false;

    const params = adaptiveManager.getCurrentParams();
    this.workout.totalSeconds = params.holdTime;
    this.workout.secondsLeft = params.holdTime;

    // Ansichten wechseln
    document.getElementById('player-prepare-view').classList.add('hidden');
    document.getElementById('player-hold-view').classList.remove('hidden');

    this.updateHoldTimerUI();
    appAudio.speak(`Halten für ${this.workout.totalSeconds} Sekunden. Gleichmäßig atmen.`);

    this.clearWorkoutTimer();
    this.workout.timer = setInterval(() => {
      if (this.workout.isPaused) return;

      this.workout.secondsLeft--;
      appAudio.playHoldTick();
      this.updateHoldTimerUI();

      if (this.workout.secondsLeft <= 0) {
        this.clearWorkoutTimer();
        this.completeExercise();
      }
    }, 1000);
  }

  updateHoldTimerUI() {
    const textEl = document.getElementById('hold-timer-text');
    const barEl = document.getElementById('hold-timer-progress');

    if (textEl) {
      textEl.textContent = `${this.workout.secondsLeft}s`;
    }

    if (barEl) {
      const circumference = 283; // 2 * PI * 45
      const fraction = this.workout.secondsLeft / Math.max(1, this.workout.totalSeconds);
      const offset = circumference * (1 - fraction);
      barEl.style.strokeDashoffset = offset;
    }
  }

  toggleHoldPause() {
    this.workout.isPaused = !this.workout.isPaused;
    const btn = document.getElementById('player-pause-btn');
    if (btn) {
      btn.textContent = this.workout.isPaused ? '▶️ Weiter' : '⏸️ Pause';
      btn.classList.toggle('bg-amber-500', this.workout.isPaused);
      btn.classList.toggle('text-white', this.workout.isPaused);
    }
  }

  clearWorkoutTimer() {
    if (this.workout.timer) {
      clearInterval(this.workout.timer);
      this.workout.timer = null;
    }
  }

  pauseTimer() {
    this.workout.isPaused = true;
    const btn = document.getElementById('player-pause-btn');
    if (btn) btn.textContent = '▶️ Weiter';
  }

  // =========================================================================
  // ERFOLG & FEEDBACK PHASE
  // =========================================================================

  completeExercise() {
    this.clearWorkoutTimer();
    this.workout.phase = 'feedback';

    const currentExercise = this.workout.playlist[this.workout.currentIndex];

    // 1. Audio & Jubel
    appAudio.playSuccessChime();
    confettiManager.fire(70);
    const praise = appAudio.speakRandomEncouragement();

    // 2. Feedback-Ansicht einblenden
    document.getElementById('player-hold-view').classList.add('hidden');
    document.getElementById('player-feedback-view').classList.remove('hidden');

    const praiseText = document.getElementById('feedback-praise-text');
    if (praiseText) {
      praiseText.textContent = praise;
    }
  }

  submitFeedback(rating) {
    const ex = this.workout.playlist[this.workout.currentIndex];
    if (ex) {
      const adaptMsg = adaptiveManager.recordFeedback(ex.id, ex.name, rating);
      if (adaptMsg) {
        appAudio.speak(adaptMsg);
      }
    }

    // Nächste Übung
    this.workout.currentIndex++;
    this.loadCurrentWorkoutExercise();
  }

  skipExercise() {
    this.clearWorkoutTimer();
    appAudio.speak('Übung übersprungen');
    this.workout.currentIndex++;
    this.loadCurrentWorkoutExercise();
  }

  // =========================================================================
  // WORKOUT ABSCHLUSS
  // =========================================================================

  showSummaryView() {
    this.workout.phase = 'summary';
    this.clearWorkoutTimer();

    document.getElementById('player-prepare-view').classList.add('hidden');
    document.getElementById('player-hold-view').classList.add('hidden');
    document.getElementById('player-feedback-view').classList.add('hidden');
    document.getElementById('player-summary-view').classList.remove('hidden');

    appAudio.playLevelUpFanfare();
    confettiManager.fire(120);

    const count = this.workout.playlist.length;
    const streakStats = adaptiveManager.getStreakStats();

    document.getElementById('summary-count-text').textContent = `${count} Übungen erfolgreich abgeschlossen!`;
    document.getElementById('summary-streak-text').textContent = `Aktueller Streak: ${streakStats.streak} Tage in Folge 🔥`;

    appAudio.speak(`Fantastisch! Du hast alle ${count} Übungen des heutigen Programms gemeistert.`);
  }

  closeWorkout() {
    this.clearWorkoutTimer();
    this.switchTab('start');
  }

  handleSpaceKey() {
    if (this.workout.phase === 'prepare') {
      this.startHoldingPhase();
    } else if (this.workout.phase === 'hold') {
      this.completeExercise();
    } else if (this.workout.phase === 'feedback') {
      this.submitFeedback('ok');
    }
  }

  // =========================================================================
  // MODALS & EINSTELLUNGEN
  // =========================================================================

  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    const params = adaptiveManager.getCurrentParams();
    document.getElementById('setting-level-select').value = params.level;
    document.getElementById('setting-auto-adaptive').checked = params.autoAdaptive;

    modal.classList.remove('hidden');
  }

  saveSettingsModal() {
    const lvl = parseInt(document.getElementById('setting-level-select').value, 10);
    const auto = document.getElementById('setting-auto-adaptive').checked;

    adaptiveManager.setLevel(lvl);
    adaptiveManager.settings.autoAdaptive = auto;
    adaptiveManager.saveSettings();

    document.getElementById('settings-modal').classList.add('hidden');
    this.updateUIState();
    appAudio.speak('Einstellungen gespeichert.');
  }

  // =========================================================================
  // TAGEBUCH & STATISTIK
  // =========================================================================

  renderDiary() {
    const listEl = document.getElementById('diary-list');
    const streakEl = document.getElementById('diary-streak-badge');
    const totalEl = document.getElementById('diary-total-count');

    const diary = adaptiveManager.getDiary();
    const streakStats = adaptiveManager.getStreakStats();

    if (streakEl) streakEl.textContent = `${streakStats.streak} Tage`;
    if (totalEl) totalEl.textContent = `${diary.length} Einheiten`;

    if (!listEl) return;

    if (diary.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-12 text-slate-500 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
          <p class="text-4xl mb-2">📖</p>
          <p class="font-bold">Noch keine Trainingseinträge vorhanden.</p>
          <p class="text-xs">Starten Sie heute Ihre erste geführte Reha-Einheit!</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = diary.slice(0, 50).map(entry => {
      const date = new Date(entry.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });

      let ratingBadge = '';
      if (entry.rating === 'easy') ratingBadge = '<span class="px-2 py-0.5 rounded-lg text-xs bg-blue-100 text-blue-800 font-bold">Leicht</span>';
      else if (entry.rating === 'hard') ratingBadge = '<span class="px-2 py-0.5 rounded-lg text-xs bg-amber-100 text-amber-800 font-bold">Anstrengend</span>';
      else ratingBadge = '<span class="px-2 py-0.5 rounded-lg text-xs bg-emerald-100 text-emerald-800 font-bold">Optimal</span>';

      return `
        <div class="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div class="flex items-center gap-3">
            <span class="text-2xl">✅</span>
            <div>
              <p class="font-black text-slate-900">${entry.gestureName}</p>
              <p class="text-xs text-slate-500">${dateStr} um ${timeStr} Uhr · Hand: ${entry.hand}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="inline-block px-2.5 py-1 rounded-xl text-xs font-black border text-emerald-700 bg-emerald-50 border-emerald-200">
              ${entry.holdTime}s gehalten
            </span>
            <div class="mt-1">${ratingBadge}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  exportDiaryJSON() {
    const data = adaptiveManager.getDiary();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestikfit-reha-bericht-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  updateUIState() {
    const params = adaptiveManager.getCurrentParams();
    this.updateHandUI(params.handPreference);
  }
}

// Globales Singleton
const app = new GestikApp();

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
