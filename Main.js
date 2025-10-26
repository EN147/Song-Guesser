// ======= 1) Tracks ======= This will be changed to a db at some point
let tracks = [];
let currentIndex;
let titles = []; creators = []; titlesNorm = []; creatorsNorm = [];
const playBtn = document.getElementById('play');

fetch('tracks.json')
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(data => {
        tracks = data;
        initTracks(); // Initialize YouTube player after tracks are loaded
    })
    .catch(error => {
        console.error('Error loading tracks.json:', error);
    });

function initTracks() {
    currentIndex = Math.floor(Math.random() * tracks.length);
    titles = tracks.map(t => t.title);
    titlesNorm = titles.map(t => normalize(t));
    creators = tracks.map(t => t.creator);
    creatorsNorm = creators.map(t => normalize(t));
    playBtn.disabled = false; //Make sure the play button is disabled until YT is ready
}

function normalize(s) {
    return (s || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, ''); // optional: strip punctuation
}



// ======= 2) Game config =======
const previewSteps = [1, 2, 4, 7, 11, 16]; // seconds (Change this to change the amount of guesses at what time the player will use)
const barsEl = document.getElementById('bars');
const historyEl = document.querySelector('.history');
let volumeCache = 50;
let cloneBarsEl = null;
let guessHistory = [];

for (let i = 0; i < previewSteps.length; i++) {
    const b = document.createElement('div');
    b.className = 'box';
    barsEl.appendChild(b);

    const h = document.createElement('div');
    h.className = 'card card--fixed';
    const t = document.createElement('p');
    t.classList = 'text';
    h.appendChild(t);
    historyEl.appendChild(h);
}

// ======= 3) State =======
const outcomes = Array(previewSteps.length).fill(null); // Matches the size of the amount of guesses the player will have and fills each spot with null. These nulls will be replaced with outcome kinds
let player, ready = false
let attemptIdx = 0;
let segTimer = null;
let pendingStopMs = null;
let acOpen = false;
let acIndex = -1; // highlighted item index, -1 = none
let acItems = []; // last rendered matches [{label, idx}]

const root = document.documentElement;
const skipBtn = document.getElementById('skip');
const guessInput = document.getElementById('guess');
const submitBtn = document.getElementById('submit');
const statusEl = document.getElementById('status');
const lenEl = document.getElementById('len');
const attemptEl = document.getElementById('attempt');
const setVolume = document.getElementById('volumeAdj');
const nextBtn = document.getElementById('next');
const results = document.querySelector('.results');
const main = document.querySelector('.main');
const toggle = document.getElementById('darkToggle');

// ======= 4) YouTube IFrame API =======
function initYouTube() {
    const playerVars = { controls: 1, disablekb: 1, rel: 0, playsinline: 1 };
    if (location.protocol === 'http:' || location.protocol === 'https:') {
        playerVars.origin = location.origin;
    }

    player = new YT.Player('yt', {
        height: '390',
        width: '640',
        playerVars,
        events: {
            onReady: () => {
                ready = true;
                playBtn.disabled = false;
                console.log('[YT] onReady fired');
            },
            onStateChange: (e) => {
                // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 5 = CUED
                if (e.data === YT.PlayerState.PLAYING && pendingStopMs != null) {
                    player.setVolume(volumeCache);
                    clearTimeout(segTimer);
                    segTimer = setTimeout(() => {
                        player.pauseVideo();
                        pendingStopMs = null;
                    }, pendingStopMs);
                }
            }
        }
    });
}

window.onYouTubeIframeAPIReady = function () {
    console.log('[YT] API ready callback');
    initYouTube();
};

// If the API script loaded before our file finished parsing
if (window.YT && YT.loaded && typeof initYouTube === 'function') {
    initYouTube();
}

function whenPlayerReady(fn) {
    if (player && typeof player.getPlayerState === 'function') return fn();
    const t = setInterval(() => {
        if (player && typeof player.getPlayerState === 'function') {
            clearInterval(t);
            fn();
        }
    }, 50);
}

function playSegment(seconds) {
    //console.log('[YT] Play button Test');
    if (!ready) { console.warn('[YT] not ready yet'); return; }
    if (!player) { console.warn('[YT] player not initialized'); return; }
    if (!player.loadVideoById) { console.warn('[YT] API not attached to HTML'); return; }

    const t = tracks[currentIndex];
    pendingStopMs = seconds * 1000;

    whenPlayerReady(() => {
        // Make sure we’re audible.
        try { player.unMute(); } catch { }
        try { player.setVolume(volumeCache); } catch { }

        // Load + play from the desired start.
        player.loadVideoById({ videoId: t.id, startSeconds: t.start });

        // Some browsers need a nudge after load.
        setTimeout(() => {
            if (player.getPlayerState && player.getPlayerState() !== YT.PlayerState.PLAYING) {
                player.playVideo(); // Doesn't work if the loaded video has an ad
            }
        }, 200);
    });
}

function markOutcome(kind) {
    outcomes[attemptIdx] = kind;
}

function updateUI() {
    lenEl.textContent = previewSteps[attemptIdx];
    attemptEl.textContent = attemptIdx + 1;
    [...barsEl.children].forEach((b, i) => {
        b.classList.remove('skip', 'miss', 'correct');
        if (outcomes[i]) b.classList.add(outcomes[i]);
    });
}

function nextTrack() {
    document.querySelectorAll('.history .text').forEach(p => {
        p.textContent = '';
    });

    results.style.display = 'none';
    main.style.display = 'flex';

    whenPlayerReady(() => player.pauseVideo?.());

    if (cloneBarsEl) { cloneBarsEl.remove(); cloneBarsEl = null; }

    outcomes.fill(null);
    [...barsEl.children].forEach(b => {
        b.classList.remove('skip', 'miss', 'correct', 'filled');
    });

    attemptIdx = 0;
    currentIndex = (currentIndex + 1) % tracks.length;
    guessInput.value = '';
    guessInput.dispatchEvent(new Event('input'));
    statusEl.textContent = '';

    hideList();
    updateUI();
}

function handleSkip(kind, guessValue = '') { // remove kind and check what values is being used for guessValues
    addToGuessHistory(guessValue);
    markOutcome(kind);
    if (attemptIdx < previewSteps.length - 1) {
        attemptIdx++;
        updateUI();
        return;
    }

    loadResults();
}

function loadResults() {
    updateUI();
    const t = tracks[currentIndex];

    // hide game
    main.style.display = 'none';

    whenPlayerReady(() => {
        const data = player.getVideoData?.() || {};
        const currentId = data.video_id || "";

        player.cueVideoById({ videoId: t.id, startSeconds: t.start });
    });

    // update text + show results
    const resultsValue = document.getElementById('resultsValue');
    if (attemptIdx + 1 === 6) {
        resultsValue.textContent = `Failed! The song was ${t.title} from ${t.creator}`;
    } else {
        resultsValue.textContent = `Guessed in ${attemptIdx + 1} try/tries. The song was ${t.title} from ${t.creator}`;
    }

    cloneBarsEl = barsEl.cloneNode(true);
    cloneBarsEl.id = 'resultsBar';
    results.parentNode.appendChild(cloneBarsEl);
    results.style.display = 'block';
}

// ======= 5) Buttons =======
playBtn.addEventListener('click', () => {
    updateUI();
    playSegment(previewSteps[attemptIdx]);
});

skipBtn.addEventListener('click', () => {
    handleSkip('skip');
});

nextBtn.addEventListener('click', () => {
    nextTrack();
});

submitBtn.addEventListener('click', () => {
    const gNorm = normalize(guessInput.value);
    if (!gNorm) return guessInput.focus();
    const fullTitle = creatorsNorm[currentIndex] + ' ' + titlesNorm[currentIndex];

    if (fullTitle.includes(gNorm)) {
        markOutcome('correct');
        loadResults();
    } else {
        handleSkip('miss', guessInput.value);
    }
});

function addToGuessHistory(guessStr) {
    const card = historyEl.children[attemptIdx];
    if (!card) return;
    const p = card.querySelector('.text');
    if (p) p.textContent = guessStr;
}

guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
});

guessInput.addEventListener('blur', () => setTimeout(hideList, 100));

guessInput.addEventListener('input', () => {
    const q = normalize(guessInput.value);
    if (q.length < 2) return renderList([]);

    const matches = [];
    for (let i = 0; i < titlesNorm.length; i++) {
        const fullTitleNorm = creatorsNorm[i] + " " + titlesNorm[i];
        const fullTile = creators[i] + " " + titles[i];
        if (q && fullTitleNorm.includes(q)) {
            matches.push({ label: fullTile, idx: i });
            continue;
        }
        if (q && titlesNorm[i].includes(q)) matches.push({ label: fullTile, idx: i });
    }
    console.log('matches', matches.length);

    renderList(matches);
});

guessInput.addEventListener('keydown', (e) => {
    if (!acOpen) return;  // only handle keys when dropdown is open

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(acIndex < 0 ? 0 : acIndex + 1);
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(acIndex <= 0 ? 0 : acIndex - 1);
        return;
    }
    if (e.key === 'Enter') {
        // if list open, pick highlighted; else let your existing submit run
        if (acIndex >= 0) {
            e.preventDefault();
            selectIndex(acIndex);
        }
        return;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideList();
        return;
    }
});

guessInput.setAttribute('role', 'combobox');
guessInput.setAttribute('aria-autocomplete', 'list');
guessInput.setAttribute('aria-controls', 'ac-list');
guessInput.setAttribute('aria-activedescendant', `opt-${acIndex}`);

function renderList(items) {
    const list = document.getElementById('ac-list');
    acItems = items;
    acIndex = items.length ? 0 : -1;        // start highlighted at first item (optional)

    if (!items.length) {
        list.hidden = true;
        list.innerHTML = '';
        acOpen = false;
        return;
    }

    list.innerHTML = items
        .map((it, i) => `<li role="option" data-i="${i}" class="${i === acIndex ? 'active' : ''}">${it.label}</li>`)
        .join('');
    list.hidden = false;
    acOpen = true;
}

const acList = document.getElementById('ac-list');

acList.addEventListener('mousemove', (e) => {
    const li = e.target.closest('li[role="option"]');
    if (!li) return;
    const i = parseInt(li.dataset.i, 10);
    if (!Number.isNaN(i) && i !== acIndex) setActive(i);
});

acList.addEventListener('mousedown', (e) => {
    // prevent input from losing focus before we handle selection
    e.preventDefault();
    const li = e.target.closest('li[role="option"]');
    if (!li) return;
    selectIndex(parseInt(li.dataset.i, 10));
});

function setActive(i) {
    const list = document.getElementById('ac-list');
    if (!acItems.length) return;
    acIndex = Math.max(0, Math.min(i, acItems.length - 1));
    [...list.children].forEach((li, idx) => {
        li.classList.toggle('active', idx === acIndex);
    });
}

function selectIndex(i) {
    if (!acItems.length) return;
    setActive(i);
    guessInput.value = acItems[acIndex].label;  // commit to input
    hideList();
}

function hideList() {
    const list = document.getElementById('ac-list');
    list.hidden = true;
    list.innerHTML = '';
    acOpen = false;
    acIndex = -1;
    acItems = [];
}

function setActive(i) {
    const list = document.getElementById('ac-list');
    if (!acItems.length) return;
    acIndex = Math.max(0, Math.min(i, acItems.length - 1));
    [...list.children].forEach((li, idx) => {
        li.classList.toggle('active', idx === acIndex);
        if (idx === acIndex) {
            const r = li.getBoundingClientRect();
            const L = list.getBoundingClientRect();
            if (r.top < L.top) li.scrollIntoView({ block: 'nearest' });
            if (r.bottom > L.bottom) li.scrollIntoView({ block: 'nearest' });
        }
    });
}

toggle.addEventListener('change', () => {
    document.documentElement.classList.toggle('darkToggle', toggle.checked);
});

setVolume.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value, 10);
    volumeCache = vol;

    whenPlayerReady(() => {
        player.unMute?.();
        player.setVolume?.(vol);
    });
});


// Initial paint
updateUI();