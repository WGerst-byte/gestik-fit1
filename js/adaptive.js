/**
 * GestikFit - Adaptive Schwierigkeit & Reha-Tagebuch Manager (Kamera-frei)
 * Passt Haltezeit und Entspannungspausen automatisch an das Feedback der Patienten an.
 * Verwaltet Reha-Streak, Hand-Präferenz und lokale Statistiken.
 */

class AdaptiveManager {
  constructor() {
    this.storageKeySettings = 'gestikfit_settings';
    this.storageKeyDiary = 'gestikfit_diary';
    this.storageKeyStreak = 'gestikfit_streak';

    // Standard-Einstellungen
    this.settings = {
      level: 1, // 1 = Sanft, 2 = Aktiv, 3 = Dynamisch
      handPreference: 'beide', // 'links', 'rechts', 'beide'
      autoAdaptive: true, // Automatische Anpassung bei Feedback
      customHoldTime: null, // Manuelle Haltezeit
      caregiverMode: false // Zusätzliche Angehörigen-Hinweise einblenden
    };

    // Stufen-Profile
    this.profiles = {
      1: {
        name: 'Sanft (Stufe 1)',
        desc: 'Ideal zu Beginn oder bei Spastik: Kurzes Halten (3s), längere Lockerungspause (6s).',
        holdTime: 3,
        pauseTime: 6
      },
      2: {
        name: 'Aktiv (Stufe 2)',
        desc: 'Ausgewogenes Training: 5 Sekunden Halten für nachhaltige Muskelaktivierung.',
        holdTime: 5,
        pauseTime: 5
      },
      3: {
        name: 'Dynamisch (Stufe 3)',
        desc: 'Höhere Kraftausdauer: 8 Sekunden Halten für maximale Koordination.',
        holdTime: 8,
        pauseTime: 4
      }
    };

    this.loadSettings();
    this.updateStreak();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.storageKeySettings);
      if (saved) {
        this.settings = Object.assign(this.settings, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(this.storageKeySettings, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Could not save settings:', e);
    }
  }

  setLevel(newLevel) {
    if (this.profiles[newLevel]) {
      this.settings.level = newLevel;
      this.settings.customHoldTime = null;
      this.saveSettings();
    }
  }

  setHandPreference(hand) {
    if (['links', 'rechts', 'beide'].includes(hand)) {
      this.settings.handPreference = hand;
      this.saveSettings();
    }
  }

  toggleCaregiverMode() {
    this.settings.caregiverMode = !this.settings.caregiverMode;
    this.saveSettings();
    return this.settings.caregiverMode;
  }

  /**
   * Liefert die aktuellen Übungsparameter (Haltezeit & Pause)
   */
  getCurrentParams() {
    const p = this.profiles[this.settings.level] || this.profiles[1];
    return {
      level: this.settings.level,
      levelName: p.name,
      holdTime: this.settings.customHoldTime || p.holdTime,
      pauseTime: p.pauseTime,
      handPreference: this.settings.handPreference,
      autoAdaptive: this.settings.autoAdaptive,
      caregiverMode: this.settings.caregiverMode
    };
  }

  /**
   * Reagiert auf das Patienten-Feedback nach jeder Geste:
   * 'easy' (Zu leicht) -> Haltezeit sanft steigern oder Stufe erhöhen
   * 'ok' (Genau richtig) -> Beibehalten
   * 'hard' (Zu anstrengend) -> Haltezeit sanft senken
   */
  recordFeedback(gestureId, gestureName, feedbackRating) {
    const params = this.getCurrentParams();
    let currentHold = params.holdTime;
    let adaptationMessage = null;

    if (this.settings.autoAdaptive) {
      if (feedbackRating === 'easy') {
        if (currentHold < 10) {
          this.settings.customHoldTime = currentHold + 1;
          adaptationMessage = `Toll! Haltezeit für mehr Reiz sanft auf ${this.settings.customHoldTime}s erhöht.`;
        } else if (this.settings.level < 3) {
          this.settings.level++;
          this.settings.customHoldTime = null;
          adaptationMessage = `Fantastisch! Aufstieg in ${this.profiles[this.settings.level].name}!`;
        }
      } else if (feedbackRating === 'hard') {
        if (currentHold > 2) {
          this.settings.customHoldTime = Math.max(2, currentHold - 1);
          adaptationMessage = `Kein Problem! Haltezeit sanft auf ${this.settings.customHoldTime}s erleichtert.`;
        } else if (this.settings.level > 1) {
          this.settings.level--;
          this.settings.customHoldTime = null;
          adaptationMessage = `Sanftere Stufe aktiviert: Immer mit der Ruhe!`;
        }
      }
      this.saveSettings();
    }

    // Eintrag ins Reha-Tagebuch
    this.addDiaryEntry({
      timestamp: new Date().toISOString(),
      gestureId,
      gestureName,
      holdTime: params.holdTime,
      level: this.settings.level,
      hand: this.settings.handPreference,
      rating: feedbackRating
    });

    return adaptationMessage;
  }

  // =========================================================================
  // REHA-TAGEBUCH METHODEN
  // =========================================================================

  getDiary() {
    try {
      const data = localStorage.getItem(this.storageKeyDiary);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  addDiaryEntry(entry) {
    try {
      const list = this.getDiary();
      list.unshift(entry);
      if (list.length > 300) list.pop();
      localStorage.setItem(this.storageKeyDiary, JSON.stringify(list));
      this.updateStreak();
    } catch (e) {
      console.warn('Could not save diary entry:', e);
    }
  }

  clearDiary() {
    try {
      localStorage.removeItem(this.storageKeyDiary);
      this.updateStreak();
    } catch (e) {}
  }

  /**
   * Reha-Streak (Tage in Folge) berechnen
   */
  updateStreak() {
    try {
      const diary = this.getDiary();
      if (!diary || diary.length === 0) {
        localStorage.setItem(this.storageKeyStreak, JSON.stringify({ streak: 0, lastDate: null }));
        return 0;
      }

      const uniqueDays = Array.from(new Set(diary.map(e => e.timestamp.slice(0, 10)))).sort().reverse();
      const today = new Date().toISOString().slice(0, 10);
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().slice(0, 10);

      let currentStreak = 0;
      let checkDate = new Date();

      if (uniqueDays.includes(today) || uniqueDays.includes(yesterday)) {
        for (let i = 0; i < uniqueDays.length; i++) {
          const targetDayStr = checkDate.toISOString().slice(0, 10);
          if (uniqueDays.includes(targetDayStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            if (i === 0 && targetDayStr === today && uniqueDays.includes(yesterday)) {
              checkDate.setDate(checkDate.getDate() - 1);
              continue;
            }
            break;
          }
        }
      }

      localStorage.setItem(this.storageKeyStreak, JSON.stringify({
        streak: currentStreak,
        lastDate: uniqueDays[0] || null,
        totalTrainedGestures: diary.length
      }));

      return currentStreak;
    } catch (e) {
      return 0;
    }
  }

  getStreakStats() {
    try {
      const saved = localStorage.getItem(this.storageKeyStreak);
      return saved ? JSON.parse(saved) : { streak: 0, totalTrainedGestures: 0 };
    } catch (e) {
      return { streak: 0, totalTrainedGestures: 0 };
    }
  }
}

// Globale Instanz
const adaptiveManager = new AdaptiveManager();
