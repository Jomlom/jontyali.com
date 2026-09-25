// puzzle analytics

var PuzzleAnalytics = (function () {
  var API_BASE = 'https://api.jontyali.com';
  var ANON_ID_KEY = 'jontyali_anon_id';
  var ATTEMPT_DELAY_MS = 10000;

  var anonId = null;
  var pendingAttemptTimer = null;
  var countsPromise = null;

  function getAnonId() {
    if (anonId) return anonId;
    try {
      anonId = localStorage.getItem(ANON_ID_KEY);
      if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem(ANON_ID_KEY, anonId);
      }
    } catch (e) {
      anonId = anonId || crypto.randomUUID();
    }
    return anonId;
  }

  function postAttempt(puzzleId) {
    try {
      fetch(API_BASE + '/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzle_id: puzzleId,
          anon_id: getAnonId(),
          client_ts: Date.now()
        })
      }).catch(function () {
      });
    } catch (e) {
    }
  }

  function startAttemptTimer(puzzleId) {
    cancelAttemptTimer();
    pendingAttemptTimer = setTimeout(function () {
      pendingAttemptTimer = null;
      postAttempt(puzzleId);
    }, ATTEMPT_DELAY_MS);
  }

  function cancelAttemptTimer() {
    if (pendingAttemptTimer) {
      clearTimeout(pendingAttemptTimer);
      pendingAttemptTimer = null;
    }
  }

  function getCounts() {
    if (!countsPromise) {
      countsPromise = fetch(API_BASE + '/counts')
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          return res.json();
        })
        .catch(function () {
          return null;
        });
    }
    return countsPromise;
  }

  function renderCount(puzzleId, el) {
    if (!el) return;
    getCounts().then(function (counts) {
      if (!counts) {
        el.textContent = 'Attempts: —';
        return;
      }
      var count = counts[puzzleId] || 0;
      el.textContent = 'Attempts: ' + count;
    });
  }

  getAnonId();

  return {
    getAnonId: getAnonId,
    startAttemptTimer: startAttemptTimer,
    cancelAttemptTimer: cancelAttemptTimer,
    renderCount: renderCount
  };
})();
