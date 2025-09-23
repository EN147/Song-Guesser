// ======= 1) Your tracks (replace with your own) =======
const tracks = [
    { title: "Hanashirube", id: "1CyRX3x6aDY", start: 0 },
    { title: "Tasugare", id: "zrApXHA2ECs", start: 1 },
    { title: "Phronesis", id: "vnc6PTtsisw", start: 0 }
];

// ======= 2) Game config =======
const previewSteps = [1, 2, 4, 7, 11, 16]; // seconds
const barsEl = document.getElementById('bars');
let volumeCache = 50;

for (let i = 0; i < previewSteps.length; i++) {
    const b = document.createElement('div'); b.className = 'box'; barsEl.appendChild(b);
}

// ======= 3) State =======
let player, ready = false;     // keep these
let currentIndex = Math.floor(Math.random() * tracks.length);
let attemptIdx = 0; // 0..5
let segTimer = null;           // keep this
let pendingStopMs = null;      // moved up here so it's declared once

const playBtn = document.getElementById('play');
const skipBtn = document.getElementById('skip');
const guessInput = document.getElementById('guess');
const submitBtn = document.getElementById('submit');
const statusEl = document.getElementById('status');
const lenEl = document.getElementById('len');
const attemptEl = document.getElementById('attempt');
const setVolume = document.getElementById('volumeAdj')

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
        playSegment(previewSteps[attemptIdx]);
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

setVolume.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value, 10);
    volumeCache = vol;
    if (player && player.unMute) player.unMute();
    if (player && player.setVolume) player.setVolume(vol);
});


// Initial paint
updateUI();