/* ════════════════════════════════════════════════════════════
   Typing Speed Tool - Frontend Application
   ════════════════════════════════════════════════════════════ */

const API = '/api/typing';

// ── Theme ──
let darkMode = localStorage.getItem('theme') !== 'light';
function applyTheme() {
    document.body.classList.toggle('light-theme', !darkMode);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = darkMode ? '☀️' : '🌙';
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
}
function toggleTheme() {
    darkMode = !darkMode;
    applyTheme();
}

// ── Toast Notifications ──
function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    const duration = type === 'error' ? 4000 : 3000;
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ── State ──
let candidate = null;
let session = null;
let config = null;
let allActivePassages = { en: [], ar: [] };
let trialQueue = []; // [{ language, trialNumber, passage }, ...]
let currentTrialIndex = 0;
let results = []; // { language, trialNumber, grossWpm, netWpm, accuracy, correctWords, totalWordsAttempted, errorCount }

// Typing state
let wordsArray = [];
let currentWordIndex = 0;
let timeLeft = 60;
let timerInterval = null;
let isTyping = false;
let correctWordsCount = 0;
let totalWordsAttempted = 0;
let errorCount = 0;
let startTime = null;
let soundEnabled = true;
let tabSwitchCount = 0;

// ── Audio Context (Sound Effects) ──
let audioCtx = null;
function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playClick() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.05);
    } catch (e) { /* silent */ }
}

function playError() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
    } catch (e) { /* silent */ }
}

function playSuccess() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudio();
        [523, 659, 784].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.2);
        });
    } catch (e) { /* silent */ }
}

// ── Arabic Normalization ──
function normalizeArabic(text) {
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/\u0640/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Screen Navigation ──
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ── API Helpers ──
async function api(path, options = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Request failed');
    }
    if (res.headers.get('content-type')?.includes('text/csv')) return res.text();
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
}

// ══════════════════════════════════════════════════════
// REGISTRATION
// ══════════════════════════════════════════════════════
async function loadConfig() {
    try { config = await api('/config'); } catch (e) {
        config = { trialDurationSeconds: 60, trialsPerLanguage: 3, showLiveWpm: true, enableSoundEffects: true, voidOnTabSwitch: true };
    }
    soundEnabled = config.enableSoundEffects;
}

document.getElementById('btn-start').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const natId = document.getElementById('reg-natid').value.trim();
    const errEl = document.getElementById('reg-error');

    if (!name) { errEl.textContent = 'Please enter your full name.'; return; }
    if (!phone) { errEl.textContent = 'Please enter your phone number.'; return; }
    if (!natId) { errEl.textContent = 'Please enter the national ID.'; return; }
    errEl.textContent = '';

    try {
        document.getElementById('btn-start').disabled = true;
        document.getElementById('btn-start').textContent = 'Loading...';

        await loadConfig();
        candidate = await api('/candidates', { method: 'POST', body: JSON.stringify({ fullName: name, phoneNumber: phone, nationalId: natId }) });
        session = await api('/sessions', { method: 'POST', body: JSON.stringify({ candidateId: candidate.id }) });

        // Fetch all active passages for word pool
        const trialsPerLang = config.trialsPerLanguage;
        const enPassages = await api(`/passages/random?lang=en&count=${trialsPerLang}`);
        const arPassages = await api(`/passages/random?lang=ar&count=${trialsPerLang}`);

        // Also fetch ALL active passages for filling text
        try {
            const allEn = await api('/passages?lang=en');
            allActivePassages.en = allEn.filter(p => p.isActive);
        } catch (e) { allActivePassages.en = enPassages; }
        try {
            const allAr = await api('/passages?lang=ar');
            allActivePassages.ar = allAr.filter(p => p.isActive);
        } catch (e) { allActivePassages.ar = arPassages; }

        // Build trial queue: English first, then Arabic
        trialQueue = [];
        for (let i = 0; i < trialsPerLang; i++) {
            trialQueue.push({ language: 'en', trialNumber: i + 1, passage: enPassages[i] });
        }
        for (let i = 0; i < trialsPerLang; i++) {
            trialQueue.push({ language: 'ar', trialNumber: i + 1, passage: arPassages[i] });
        }

        currentTrialIndex = 0;
        results = [];

        // Persist test state so refresh doesn't lose progress
        sessionStorage.setItem('testState', JSON.stringify({
            candidate, session, trialQueue, allActivePassages,
            currentTrialIndex: 0, results: [],
        }));

        startTrial();
    } catch (e) {
        errEl.textContent = e.message || 'Failed to start. Please try again.';
        document.getElementById('btn-start').disabled = false;
        document.getElementById('btn-start').textContent = 'Start Test';
    }
});

// ══════════════════════════════════════════════════════
// TYPING TEST ENGINE
// ══════════════════════════════════════════════════════
function startTrial() {
    const trial = trialQueue[currentTrialIndex];
    const totalTrials = trialQueue.length;

    // Update header
    document.getElementById('test-lang-label').textContent = trial.language === 'en' ? 'English' : 'العربية';
    document.getElementById('test-trial-label').textContent = `Trial ${trial.trialNumber} of ${config.trialsPerLanguage}`;
    document.getElementById('progress-bar').style.width = `${((currentTrialIndex) / totalTrials) * 100}%`;

    // WPM visibility
    document.getElementById('wpm-stat').style.display = config.showLiveWpm ? '' : 'none';

    // Timer
    timeLeft = config.trialDurationSeconds;
    document.getElementById('timer-display').textContent = timeLeft;
    document.getElementById('live-wpm').textContent = '0';
    document.getElementById('live-accuracy').textContent = '100';

    // Setup text
    const textDisplay = document.getElementById('text-display');
    const typeInput = document.getElementById('type-input');
    const dir = trial.language === 'ar' ? 'rtl' : 'ltr';
    const fontFamily = trial.language === 'ar' ? 'var(--font-ar)' : 'var(--font-en)';
    textDisplay.setAttribute('dir', dir);
    textDisplay.style.fontFamily = fontFamily;
    typeInput.style.direction = dir;
    typeInput.style.fontFamily = fontFamily;
    typeInput.style.textAlign = dir === 'rtl' ? 'right' : 'left';

    // Build word pool from ALL active passages (not just the trial passage) to avoid repetition
    const lang = trial.language;
    const pool = (allActivePassages[lang] || []).map(p => {
        const c = lang === 'ar' ? normalizeArabic(p.content) : p.content;
        return c.split(/\s+/).filter(w => w.length > 0);
    });
    // Shuffle the passages order, but start with the trial's passage
    let content = trial.passage.content;
    if (lang === 'ar') content = normalizeArabic(content);
    const primaryWords = content.split(/\s+/).filter(w => w.length > 0);
    let allWords = [...primaryWords];
    // Add words from other passages (shuffled) to fill up
    const otherPools = pool.filter(p => p.join(' ') !== primaryWords.join(' '));
    for (let i = otherPools.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherPools[i], otherPools[j]] = [otherPools[j], otherPools[i]];
    }
    for (const p of otherPools) { allWords = allWords.concat(p); }
    // If still not enough, cycle through all
    while (allWords.length < 200) { allWords = allWords.concat([...allWords]); }
    wordsArray = allWords.slice(0, 300);

    textDisplay.innerHTML = '';
    wordsArray.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.classList.add('word');
        if (i === 0) span.classList.add('active');
        textDisplay.appendChild(span);
    });

    // Reset state
    currentWordIndex = 0;
    isTyping = false;
    correctWordsCount = 0;
    totalWordsAttempted = 0;
    errorCount = 0;
    startTime = null;
    tabSwitchCount = 0;
    clearInterval(timerInterval);

    typeInput.value = '';
    typeInput.disabled = false;
    showScreen('screen-test');
    document.getElementById('tab-warning').classList.remove('visible');
    // Mark test as actively running for anti-cheat
    window._testActive = true;
    // Reset scroll positions AFTER content is rebuilt and screen is visible
    textDisplay.scrollTop = 0;
    window.scrollTo(0, 0);
    setTimeout(() => typeInput.focus(), 150);
}

// Input handler
document.getElementById('type-input').addEventListener('input', function () {
    if (!isTyping) {
        isTyping = true;
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
    }

    const trial = trialQueue[currentTrialIndex];
    const val = this.value;
    const wordSpans = document.querySelectorAll('#text-display .word');
    const targetWord = wordsArray[currentWordIndex];
    const activeSpan = wordSpans[currentWordIndex];

    if (val.endsWith(' ') || val.endsWith('\u00A0')) {
        const typed = val.trim();
        const normalizedTyped = trial.language === 'ar' ? normalizeArabic(typed) : typed;
        const normalizedTarget = trial.language === 'ar' ? normalizeArabic(targetWord) : targetWord;

        totalWordsAttempted++;

        if (normalizedTyped === normalizedTarget) {
            activeSpan.classList.add('correct');
            correctWordsCount++;
            playClick();
        } else {
            activeSpan.classList.add('incorrect');
            errorCount++;
            playError();
        }

        activeSpan.classList.remove('active');
        this.value = '';
        currentWordIndex++;

        if (currentWordIndex < wordsArray.length) {
            const nextSpan = wordSpans[currentWordIndex];
            nextSpan.classList.add('active');
            // Auto-scroll
            const textDisplay = document.getElementById('text-display');
            if (nextSpan.offsetTop >= textDisplay.scrollTop + textDisplay.clientHeight) {
                textDisplay.scrollTop = nextSpan.offsetTop - 10;
            }
        } else {
            endTrial();
        }

        // Update live accuracy
        const acc = totalWordsAttempted > 0 ? Math.round((correctWordsCount / totalWordsAttempted) * 100) : 100;
        document.getElementById('live-accuracy').textContent = acc;
    } else if (activeSpan) {
        // Live character feedback
        const normalizedVal = trial.language === 'ar' ? normalizeArabic(val) : val;
        const normalizedTarget = trial.language === 'ar' ? normalizeArabic(targetWord) : targetWord;
        if (!normalizedTarget.startsWith(normalizedVal)) {
            activeSpan.style.color = 'var(--incorrect)';
        } else {
            activeSpan.style.color = '';
        }
    }
});

// Prevent paste, copy, cut, drop, and right-click on the test area
(function() {
    const ti = document.getElementById('type-input');
    ['paste', 'copy', 'cut', 'drop'].forEach(evt => {
        ti.addEventListener(evt, e => e.preventDefault());
    });
    ti.addEventListener('contextmenu', e => e.preventDefault());
    // Also prevent right-click on the text display
    document.getElementById('text-display').addEventListener('contextmenu', e => e.preventDefault());
})();

function updateTimer() {
    timeLeft--;
    document.getElementById('timer-display').textContent = timeLeft;

    // Live WPM
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > 0) {
        const totalChars = wordsArray.slice(0, currentWordIndex)
            .filter((_, i) => document.querySelectorAll('#text-display .word')[i]?.classList.contains('correct'))
            .reduce((sum, w) => sum + w.length + 1, 0);
        const wpm = Math.round((totalChars / 5) / (elapsed / 60));
        document.getElementById('live-wpm').textContent = wpm;
    }

    if (timeLeft <= 0) endTrial();
}

async function endTrial() {
    clearInterval(timerInterval);
    document.getElementById('type-input').disabled = true;
    isTyping = false;

    const trial = trialQueue[currentTrialIndex];
    const duration = config.trialDurationSeconds;
    const minutes = duration / 60;

    // Calculate chars for correct words
    const wordSpans = document.querySelectorAll('#text-display .word');
    let correctChars = 0;
    for (let i = 0; i < currentWordIndex && i < wordSpans.length; i++) {
        if (wordSpans[i].classList.contains('correct')) {
            correctChars += wordsArray[i].length + 1;
        }
    }

    const grossWpm = Math.round(((totalWordsAttempted > 0 ? wordsArray.slice(0, totalWordsAttempted).reduce((s, w) => s + w.length + 1, 0) : 0) / 5) / minutes) || 0;
    const netWpm = Math.max(0, Math.round(grossWpm - (errorCount / minutes)));
    const accuracy = totalWordsAttempted > 0 ? Math.round((correctWordsCount / totalWordsAttempted) * 100) : 0;

    const result = {
        language: trial.language,
        trialNumber: trial.trialNumber,
        grossWpm, netWpm, accuracy,
        correctWords: correctWordsCount,
        totalWordsAttempted,
        errorCount,
        testDuration: duration,
        passageId: trial.passage.id,
        tabSwitches: tabSwitchCount,
        wasVoided: false,
    };

    results.push(result);

    // Save to backend — MUST complete before moving on
    try {
        await api(`/sessions/${session.id}/trials`, { method: 'POST', body: JSON.stringify(result) });
    } catch (e) {
        console.error('Failed to save trial:', e);
    }

    playSuccess();

    // Next trial or summary
    currentTrialIndex++;

    // Update sessionStorage with progress
    const testState = sessionStorage.getItem('testState');
    if (testState) {
        try {
            const state = JSON.parse(testState);
            state.currentTrialIndex = currentTrialIndex;
            state.results = results;
            sessionStorage.setItem('testState', JSON.stringify(state));
        } catch (e) { /* ok */ }
    }

    if (currentTrialIndex < trialQueue.length) {
        showBetween(result);
    } else {
        window._testActive = false;
        showSummary();
    }
}

// ── Between Trials Screen ──
function showBetween(result) {
    document.getElementById('between-wpm').textContent = result.netWpm;
    document.getElementById('between-acc').textContent = result.accuracy + '%';
    document.getElementById('between-words').textContent = result.correctWords;

    const next = trialQueue[currentTrialIndex];
    const langName = next.language === 'en' ? 'English' : 'Arabic';
    document.getElementById('between-next-label').textContent = `Next: ${langName} - Trial ${next.trialNumber}`;

    showScreen('screen-between');

    let countdown = 5;
    document.getElementById('countdown-num').textContent = countdown;
    const cInterval = setInterval(() => {
        countdown--;
        document.getElementById('countdown-num').textContent = countdown;
        if (countdown <= 0) {
            clearInterval(cInterval);
            startTrial();
        }
    }, 1000);
}

// ══════════════════════════════════════════════════════
// TAB SWITCH DETECTION
// ══════════════════════════════════════════════════════
document.addEventListener('visibilitychange', () => {
    // Trigger if test screen is active (even before first keystroke)
    if (document.hidden && window._testActive) {
        tabSwitchCount++;
        if (config && config.voidOnTabSwitch) {
            clearInterval(timerInterval);
            isTyping = false;
            document.getElementById('type-input').disabled = true;
            document.getElementById('tab-warning').classList.add('visible');
        }
    }
});

document.getElementById('btn-resume-after-void').addEventListener('click', () => {
    document.getElementById('tab-warning').classList.remove('visible');
    // Void this trial and restart with same passage
    const trial = trialQueue[currentTrialIndex];
    api(`/sessions/${session.id}/trials`, {
        method: 'POST',
        body: JSON.stringify({
            language: trial.language, trialNumber: trial.trialNumber,
            grossWpm: 0, netWpm: 0, accuracy: 0, correctWords: 0,
            totalWordsAttempted: 0, errorCount: 0, testDuration: config.trialDurationSeconds,
            passageId: trial.passage.id, tabSwitches: tabSwitchCount, wasVoided: true,
        }),
    }).catch(() => {});
    startTrial();
});

// Sound is controlled via admin config only (no candidate toggle)

// ══════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════
async function showSummary() {
    // Update progress bar to 100%
    document.getElementById('progress-bar').style.width = '100%';

    // Fill candidate info
    document.getElementById('sum-name').textContent = candidate.fullName;
    document.getElementById('sum-phone').textContent = candidate.phoneNumber;
    document.getElementById('sum-natid').textContent = candidate.nationalId || '';

    // Fill tables
    const enResults = results.filter(r => r.language === 'en' && !r.wasVoided).sort((a, b) => a.trialNumber - b.trialNumber);
    const arResults = results.filter(r => r.language === 'ar' && !r.wasVoided).sort((a, b) => a.trialNumber - b.trialNumber);

    fillSummaryTable('sum-en-body', enResults);
    fillSummaryTable('sum-ar-body', arResults);

    // Averages
    const avgEn = avg(enResults, 'netWpm');
    const avgAr = avg(arResults, 'netWpm');
    const avgAccEn = avg(enResults, 'accuracy');
    const avgAccAr = avg(arResults, 'accuracy');
    document.getElementById('sum-en-avg-wpm').textContent = avgEn;
    document.getElementById('sum-en-avg-acc').textContent = avgAccEn + '%';
    document.getElementById('sum-ar-avg-wpm').textContent = avgAr;
    document.getElementById('sum-ar-avg-acc').textContent = avgAccAr + '%';

    // Mark session as completed (trials already saved at this point)
    try {
        await api(`/sessions/${session.id}/complete`, { method: 'PATCH' });
    } catch (e) {
        console.error('Failed to complete session:', e);
    }

    // Clear persisted test state — test is done
    sessionStorage.removeItem('testState');

    showScreen('screen-summary');
}

function fillSummaryTable(tbodyId, arr) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    arr.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.trialNumber}</td><td>${r.netWpm}</td><td>${r.accuracy}%</td>`;
        tbody.appendChild(tr);
    });
}

function avg(arr, key) {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((s, r) => s + r[key], 0) / arr.length);
}

// (New Test button removed - candidates see thank-you message instead)

// ══════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════════════════
const passageModal = document.getElementById('passage-modal');
let currentPassageLang = 'en';
let editingPassageId = null;

// Registration tab switching
document.querySelectorAll('.reg-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.reg-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.reg-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.panel).classList.add('active');
    });
});

// Inline admin login
document.getElementById('btn-admin-login-inline').addEventListener('click', async () => {
    const pass = document.getElementById('admin-pass-inline').value;
    try {
        const result = await api('/admin/verify-password', {
            method: 'POST',
            body: JSON.stringify({ password: pass }),
        });
        if (result.valid) {
            sessionStorage.setItem('adminAuth', '1');
            openAdmin();
        } else {
            document.getElementById('admin-inline-error').textContent = 'Incorrect password.';
        }
    } catch (e) {
        document.getElementById('admin-inline-error').textContent = 'Login failed: ' + e.message;
    }
});
document.getElementById('admin-pass-inline').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-admin-login-inline').click();
});

document.getElementById('btn-admin-back').addEventListener('click', () => {
    sessionStorage.removeItem('adminAuth');
    showScreen('screen-register');
});

// Admin tabs
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
});

async function openAdmin() {
    showScreen('screen-admin');
    await loadConfig();
    loadAdminStats();
    loadAdminResults();
    loadPassages();
    loadSettingsForm();
}

// ── Admin Stats ──
async function loadAdminStats() {
    try {
        const stats = await api('/admin/stats');
        const el = document.getElementById('admin-stats');
        const enStat = stats.avgByLanguage.find(s => s.language === 'en') || {};
        const arStat = stats.avgByLanguage.find(s => s.language === 'ar') || {};
        el.innerHTML = `
            <div class="stat-card"><div class="sc-val">${stats.totalCandidates}</div><div class="sc-lbl">Candidates</div></div>
            <div class="stat-card"><div class="sc-val">${stats.totalSessions}</div><div class="sc-lbl">Sessions</div></div>
            <div class="stat-card"><div class="sc-val">${enStat.avgWpm || 0} / ${arStat.avgWpm || 0}</div><div class="sc-lbl">Avg WPM (EN/AR)</div></div>
            <div class="stat-card"><div class="sc-val">${enStat.avgAccuracy || 0}% / ${arStat.avgAccuracy || 0}%</div><div class="sc-lbl">Avg Accuracy</div></div>
        `;
    } catch (e) { showToast('Failed to load stats', 'error'); }
}

// ── Admin Results ──
let searchTimeout;
let currentPage = 1;
const PAGE_SIZE = 20;
let currentSearch = '';
let totalResults = 0;

document.getElementById('admin-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearch = e.target.value;
        currentPage = 1;
        loadAdminResults();
    }, 400);
});

document.getElementById('page-prev').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadAdminResults(); }
});
document.getElementById('page-next').addEventListener('click', () => {
    const totalPages = Math.ceil(totalResults / PAGE_SIZE);
    if (currentPage < totalPages) { currentPage++; loadAdminResults(); }
});

function renderPageNumbers(totalPages) {
    const container = document.getElementById('page-numbers');
    container.innerHTML = '';
    const pages = [];
    // Always show: first, last, current ±2
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            pages.push(i);
        }
    }
    let last = 0;
    pages.forEach(p => {
        if (p - last > 1) {
            const dot = document.createElement('span');
            dot.className = 'page-btn ellipsis';
            dot.textContent = '…';
            container.appendChild(dot);
        }
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => { currentPage = p; loadAdminResults(); });
        container.appendChild(btn);
        last = p;
    });
}

async function loadAdminResults() {
    try {
        const data = await api(`/admin/results?search=${encodeURIComponent(currentSearch)}&limit=${PAGE_SIZE}&page=${currentPage}`);
        totalResults = data.total;
        const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

        // Update pagination controls
        document.getElementById('page-prev').disabled = currentPage <= 1;
        document.getElementById('page-next').disabled = currentPage >= totalPages;
        document.getElementById('page-info').textContent = `${totalResults} results`;
        renderPageNumbers(totalPages);

        const tbody = document.getElementById('results-body');
        tbody.innerHTML = '';
        if (data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px">No results found</td></tr>';
            return;
        }
        data.data.forEach(row => {
            const tr = document.createElement('tr');
            const date = row.completedAt ? new Date(row.completedAt).toLocaleDateString() : '-';
            tr.innerHTML = `
                <td>${row.candidateName}</td><td>${row.phoneNumber}</td><td>${row.nationalId || '-'}</td>
                <td>${date}</td><td>${row.avgEnWpm}</td><td>${row.avgArWpm}</td>
                <td>${row.avgEnAccuracy}%</td><td>${row.avgArAccuracy}%</td>
                <td>
                    <button class="icon-btn pdf-btn" title="Download PDF" data-session="${row.sessionId}">📄</button>
                    <button class="expand-btn" data-session="${row.sessionId}">▼</button>
                </td>
            `;
            tbody.appendChild(tr);

            // Expandable detail row
            const detailTr = document.createElement('tr');
            detailTr.classList.add('expanded-row');
            detailTr.style.display = 'none';
            detailTr.innerHTML = `<td colspan="9">
                <table>
                    <thead><tr><th>Lang</th><th>Trial</th><th>Net WPM</th><th>Gross WPM</th><th>Accuracy</th><th>Correct</th><th>Errors</th><th>Tab Sw</th></tr></thead>
                    <tbody>
                        ${[...row.enTrials, ...row.arTrials].map(t => `
                            <tr${t.wasVoided ? ' style="opacity:0.4;text-decoration:line-through"' : ''}>
                                <td>${t.language.toUpperCase()}</td><td>${t.trialNumber}</td>
                                <td>${t.netWpm}</td><td>${t.grossWpm}</td><td>${t.accuracy}%</td>
                                <td>${t.correctWords}</td><td>${t.errorCount}</td><td>${t.tabSwitches}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </td>`;
            tbody.appendChild(detailTr);

            tr.querySelector('.expand-btn').addEventListener('click', function() {
                const visible = detailTr.style.display !== 'none';
                detailTr.style.display = visible ? 'none' : '';
                this.textContent = visible ? '▼' : '▲';
            });

            // PDF Download
            tr.querySelector('.pdf-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                const sid = this.dataset.session;
                const a = document.createElement('a');
                a.href = API + `/sessions/${sid}/pdf`;
                a.download = '';
                a.click();
            });

        });
    } catch (e) { showToast('Failed to load results', 'error'); }
}

// Excel Export
document.getElementById('btn-export-csv').addEventListener('click', async () => {
    try {
        const res = await fetch(API + '/admin/results/export');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'typing-results.xlsx'; a.click();
        URL.revokeObjectURL(url);
    } catch (e) { showToast('Export failed: ' + e.message, 'error'); }
});

// ── Passages ──
let passages = { en: [], ar: [] };
document.querySelectorAll('.passage-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.passage-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentPassageLang = tab.dataset.lang;
        renderPassages();
    });
});

async function loadPassages() {
    try {
        const all = await api('/passages');
        passages.en = all.filter(p => p.language === 'en');
        passages.ar = all.filter(p => p.language === 'ar');
        renderPassages();
    } catch (e) { showToast('Failed to load passages', 'error'); }
}

function renderPassages() {
    const list = document.getElementById('passages-list');
    const items = passages[currentPassageLang] || [];
    list.innerHTML = '';
    if (items.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px">No passages found</p>';
        return;
    }
    items.forEach(p => {
        const div = document.createElement('div');
        div.className = 'passage-item' + (p.isActive ? '' : ' disabled');
        div.innerHTML = `
            <span class="p-text">${p.content}</span>
            <span class="p-words">${p.wordCount} words</span>
            <div class="p-actions">
                <button onclick="editPassage(${p.id})" title="Edit">✏️</button>
                <button onclick="togglePassageActive(${p.id})" title="${p.isActive ? 'Disable' : 'Enable'}">${p.isActive ? '🟢' : '🔴'}</button>
                <button onclick="deletePassageItem(${p.id})" title="Delete">🗑️</button>
            </div>
        `;
        list.appendChild(div);
    });
}

document.getElementById('btn-add-passage').addEventListener('click', () => {
    editingPassageId = null;
    document.getElementById('passage-modal-title').textContent = 'Add Passage';
    document.getElementById('passage-lang-select').value = currentPassageLang;
    document.getElementById('passage-content').value = '';
    document.getElementById('passage-preview').style.display = 'none';
    passageModal.classList.add('visible');
    document.getElementById('passage-content').focus();
});

window.editPassage = async (id) => {
    const p = [...passages.en, ...passages.ar].find(x => x.id === id);
    if (!p) return;
    editingPassageId = id;
    document.getElementById('passage-modal-title').textContent = 'Edit Passage';
    document.getElementById('passage-lang-select').value = p.language;
    document.getElementById('passage-content').value = p.content;
    if (p.language === 'ar') {
        document.getElementById('passage-preview').style.display = 'block';
        document.getElementById('passage-preview-text').textContent = normalizeArabic(p.content);
    } else {
        document.getElementById('passage-preview').style.display = 'none';
    }
    passageModal.classList.add('visible');
};

// Arabic preview on textarea input
document.getElementById('passage-content').addEventListener('input', () => {
    const lang = document.getElementById('passage-lang-select').value;
    if (lang === 'ar') {
        document.getElementById('passage-preview').style.display = 'block';
        document.getElementById('passage-preview-text').textContent = normalizeArabic(document.getElementById('passage-content').value);
    }
});
document.getElementById('passage-lang-select').addEventListener('change', () => {
    const lang = document.getElementById('passage-lang-select').value;
    document.getElementById('passage-preview').style.display = lang === 'ar' ? 'block' : 'none';
    if (lang === 'ar') {
        document.getElementById('passage-preview-text').textContent = normalizeArabic(document.getElementById('passage-content').value);
    }
});

document.getElementById('btn-passage-save').addEventListener('click', async () => {
    const content = document.getElementById('passage-content').value.trim();
    const lang = document.getElementById('passage-lang-select').value;
    if (!content) return;
    try {
        if (editingPassageId) {
            await api(`/passages/${editingPassageId}`, { method: 'PUT', body: JSON.stringify({ content }) });
        } else {
            await api('/passages', { method: 'POST', body: JSON.stringify({ language: lang, content }) });
        }
        passageModal.classList.remove('visible');
        await loadPassages();
    } catch (e) { showToast(e.message, 'error'); }
});

document.getElementById('btn-passage-cancel').addEventListener('click', () => passageModal.classList.remove('visible'));

window.togglePassageActive = async (id) => {
    try {
        await api(`/passages/${id}/toggle`, { method: 'PATCH' });
        await loadPassages();
    } catch (e) { showToast(e.message, 'error'); }
};

window.deletePassageItem = async (id) => {
    if (!confirm('Delete this passage?')) return;
    try {
        await api(`/passages/${id}`, { method: 'DELETE' });
        await loadPassages();
    } catch (e) { showToast(e.message, 'error'); }
};

// ── Settings ──
function loadSettingsForm() {
    document.getElementById('cfg-duration').value = config.trialDurationSeconds;
    document.getElementById('cfg-trials').value = config.trialsPerLanguage;
    document.getElementById('cfg-show-wpm').checked = config.showLiveWpm;
    document.getElementById('cfg-sounds').checked = config.enableSoundEffects;
    document.getElementById('cfg-void-tab').checked = config.voidOnTabSwitch;
}

document.getElementById('btn-save-config').addEventListener('click', async () => {
    try {
        config = await api('/config', {
            method: 'PUT',
            body: JSON.stringify({
                trialDurationSeconds: parseInt(document.getElementById('cfg-duration').value),
                trialsPerLanguage: parseInt(document.getElementById('cfg-trials').value),
                showLiveWpm: document.getElementById('cfg-show-wpm').checked,
                enableSoundEffects: document.getElementById('cfg-sounds').checked,
                voidOnTabSwitch: document.getElementById('cfg-void-tab').checked,
            }),
        });
        soundEnabled = config.enableSoundEffects;
        showToast('Settings saved!', 'success');
    } catch (e) { showToast('Failed to save: ' + e.message, 'error'); }
});

// Restore Defaults – Passages
document.getElementById('btn-reset-passages').addEventListener('click', async () => {
    if (!confirm('Reset all passages to defaults? This will delete any custom passages.')) return;
    try {
        await api('/admin/reset-passages', { method: 'POST' });
        showToast('Passages restored to defaults!', 'success');
        await loadPassages();
    } catch (e) { showToast('Failed to reset passages: ' + e.message, 'error'); }
});

// Restore Defaults – Settings
document.getElementById('btn-reset-config').addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    try {
        config = await api('/admin/reset-config', { method: 'POST' });
        soundEnabled = config.enableSoundEffects;
        loadSettingsForm();
        showToast('Settings restored to defaults!', 'success');
    } catch (e) { showToast('Failed to reset settings: ' + e.message, 'error'); }
});

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
applyTheme();
document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);

// Restore admin session if previously authenticated
if (sessionStorage.getItem('adminAuth') === '1') {
    openAdmin();
} else if (sessionStorage.getItem('testState')) {
    // Restore candidate test session after refresh
    try {
        const state = JSON.parse(sessionStorage.getItem('testState'));
        candidate = state.candidate;
        session = state.session;
        trialQueue = state.trialQueue;
        allActivePassages = state.allActivePassages;
        currentTrialIndex = state.currentTrialIndex || 0;
        results = state.results || [];
        loadConfig().then(() => startTrial());
    } catch (e) {
        sessionStorage.removeItem('testState');
        showScreen('screen-register');
    }
} else {
    showScreen('screen-register');
}
