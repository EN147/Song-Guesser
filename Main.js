// ======= 1) Your tracks (replace with your own) =======
const tracks = [
    { creator: "Atelier Ayesha", title: "Hanashirube", id: "1CyRX3x6aDY", start: 0 },
    { creator: "Atelier Ayesha", title: "Tasugare", id: "zrApXHA2ECs", start: 1 },
    { creator: "Atelier Sophie", title: "Phronesis", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test1", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test2", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test3", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test4", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test5", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test6", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test7", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test8", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test9", id: "vnc6PTtsisw", start: 0 },
    { creator: "Atelier Sophie", title: "Test10", id: "vnc6PTtsisw", start: 0 }
];

// ======= 2) Game config =======
const previewSteps = [1, 2, 4, 7, 11, 16]; // seconds
const barsEl = document.getElementById('bars');
let volumeCache = 50;

for (let i = 0; i < previewSteps.length; i++) {
    const b = document.createElement('div');
    b.className = 'box'; barsEl.appendChild(b);
}

// ======= 3) State =======
let player, ready = false;     // keep these
let currentIndex = Math.floor(Math.random() * tracks.length);
let attemptIdx = 0; // 0..5
let segTimer = null;           // keep this
let pendingStopMs = null;      // moved up here so it's declared once
let acOpen = false;
let acIndex = -1;     // highlighted item index, -1 = none
let acItems = [];     // last rendered matches [{label, idx}]


const playBtn = document.getElementById('play');
const skipBtn = document.getElementById('skip');
const guessInput = document.getElementById('guess');
const submitBtn = document.getElementById('submit');
const statusEl = document.getElementById('status');
const lenEl = document.getElementById('len');
const attemptEl = document.getElementById('attempt');
const setVolume = document.getElementById('volumeAdj')

function normalize(s) {
    return (s || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, ''); // optional: strip punctuation
}

const titles = tracks.map(t => t.title);
const titlesNorm = titles.map(t => normalize(t));
const creators = tracks.map(t => t.creator);
const creatorsNorm = creators.map(t => normalize(t));


// ======= 4) YouTube IFrame API plumbing =======
window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('yt', {
        height: '0',
        width: '0',
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1 },
        events: {
            onReady: () => {
                ready = true;
                player.setVolume(volumeCache);
                console.log('[YT] ready');
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
};

function playSegment(seconds) {
    if (!ready) { console.warn('[YT] not ready yet'); return; }

    const t = tracks[currentIndex];
    pendingStopMs = seconds * 1000;

    // Make sure we’re audible.
    try { player.unMute(); } catch { }
    try { player.setVolume(volumeCache); } catch { }

    // Load + play from the desired start.
    player.loadVideoById({ videoId: t.id, startSeconds: t.start });

    // Some browsers need a nudge after load.
    setTimeout(() => {
        if (player.getPlayerState && player.getPlayerState() !== YT.PlayerState.PLAYING) {
            player.playVideo();
        }
    }, 200);
}

function pauseSegment() {
    pendingStopMs = null;
    clearTimeout(segTimer);
    player && player.pauseVideo();
}

function updateUI() {
    lenEl.textContent = previewSteps[attemptIdx];
    attemptEl.textContent = attemptIdx + 1;
    [...barsEl.children].forEach((b, i) => {
        b.classList.toggle('filled', i <= attemptIdx);
    });
}

function nextTrack() {
    player && player.pauseVideo();
    attemptIdx = 0;
    currentIndex = (currentIndex + 1) % tracks.length;
    statusEl.textContent = '';
    updateUI();
}

function handleSkip() {
    if (attemptIdx < previewSteps.length - 1) {
        attemptIdx++;
        updateUI();
    } else {
        statusEl.innerHTML = `<span class="wrong">Out of tries.</span> It was: <b>${tracks[currentIndex].title}</b>.`;
        nextTrack();
    }
}

// ======= 5) Wire up buttons =======
playBtn.addEventListener('click', () => {
    updateUI();
    playSegment(previewSteps[attemptIdx]);
});

skipBtn.addEventListener('click', handleSkip);

submitBtn.addEventListener('click', () => {
    const g = (guessInput.value || '').trim().toLowerCase();
    if (!g) return guessInput.focus();
    const title = tracks[currentIndex].title.toLowerCase();
    if (title.includes(g)) {
        statusEl.innerHTML = `<span class="correct">Correct!</span> ${tracks[currentIndex].title}`;
        nextTrack();
        guessInput.value = '';
    } else {
        statusEl.innerHTML = `<span class="wrong">Nope.</span>`;
        handleSkip();
    }
});

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

    renderList(matches);  // see D
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


setVolume.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value, 10);
    volumeCache = vol;
    if (player && player.unMute) player.unMute();
    if (player && player.setVolume) player.setVolume(vol);
});


// Initial paint
updateUI();