/* Lightweight offline/mock backend for Mines game */
/* Scope: this SW intercepts API calls to prod backend and serves local responses */

const BACKEND_ORIGIN = 'https://prod-rnd-backend-php-orchestra.100hp.app';
const API_PREFIX = '/mines';

// Simple in-SW store (resets on reload)
const store = {
    user: {
        language: 'ru',
        currency: 'UZS',
        sessionId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        balance: 100000,
        name: 'Player',
        avatar: '',
        exchangeRate: 12550.000334
    },
    settings: {
        supportedCurrencies: ['USD', 'UZS'],
        bets: {
            USD: { quickBets: { x2: 'x2', '1/2': '1/2', min: 0.1, max: 200 }, defaultBet: 1, steps: [] },
            UZS: { quickBets: { x2: 'x2', '1/2': '1/2', min: 1000, max: 2000000 }, defaultBet: 10000, steps: [] }
        },
        presets: [
            { presetValue: 1, isDefault: false },
            { presetValue: 3, isDefault: true },
            { presetValue: 5, isDefault: false },
            { presetValue: 7, isDefault: false }
        ],
        // Coefficients roughly matching snapshots (length 24 for 25 rounds typical; keep simple set)
        rates: [
            { presetValue: 1, rates: [0.99,1.04,1.09,1.14,1.19,1.26,1.33,1.4,1.49,1.59,1.71,1.84,1.99,2.17,2.39,2.65,2.98,3.41,3.98,4.78,5.97,7.96,11.94,23.88] },
            { presetValue: 3, rates: [1.09,1.24,1.43,1.65,1.93,2.27,2.69,3.23,3.92,4.83,6.03,7.68,9.98,13.31,18.3,26.15,39.22,62.76,109.83,219.65,549.13,2196.5] },
            { presetValue: 5, rates: [1.19,1.51,1.93,2.49,3.27,4.36,5.92,8.2,11.62,16.9,25.34,39.42,64.06,109.83,201.35,402.69] },
            { presetValue: 7, rates: [1.32,1.86,2.68,3.93,5.89,9.11,14.43,23.6,40.13,71.34,133.76,267.52] }
        ],
        roundsCount: 25
    },
    sessions: [], // history (inactive)
    activeSession: null
};

function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function getRatesForPreset(presetValue) {
    const entry = store.settings.rates.find(r => r.presetValue === presetValue);
    return entry ? entry.rates.slice() : [];
}

function randomBoard(trapsCount) {
    // 5x5 board, pick trapsCount bomb positions
    const all = [];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            all.push({ col, row });
        }
    }
    // simple shuffle
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    const bombs = new Set(all.slice(0, Math.min(trapsCount, 25)).map(p => `${p.col},${p.row}`));
    // expectedChoices used to reveal at end
    const expectedChoices = [];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const isBomb = bombs.has(`${col},${row}`) ? 1 : 0;
            expectedChoices.push({ value: { col, row }, category: isBomb });
        }
    }
    return { bombs, expectedChoices };
}

function buildSession({ amount, presetValue }) {
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
    const { bombs, expectedChoices } = randomBoard(presetValue || 3);
    const coefficients = getRatesForPreset(presetValue || 3);
    const nowIso = new Date().toISOString();
    return {
        id,
        state: 'Active',
        bet: amount,
        hash: '',
        salt: '',
        lastRound: 0,
        coefficient: 0,
        availableCashout: 0,
        startDate: nowIso,
        endDate: '',
        currency: store.user.currency,
        gameData: {
            presetValue: presetValue || 3,
            coefficients,
            userChoices: [], // items: { value:{col,row}, category: 0|1 }
            expectedChoices
        },
        _internal: { bombs }
    };
}

function finishRound(session, click) {
    const key = `${click.col},${click.row}`;
    const isBomb = session._internal.bombs.has(key);
    const nextRound = session.lastRound + 1;
    const coeff = session.gameData.coefficients[Math.max(0, nextRound - 1)] || session.coefficient || 0;
    const choice = { value: { col: click.col, row: click.row }, category: isBomb ? 1 : 0 };
    session.gameData.userChoices.push(choice);
    session.lastRound = nextRound;
    session.coefficient = isBomb ? session.coefficient : coeff;
    if (isBomb) {
        session.state = 'Loss';
        session.availableCashout = 0;
        session.endDate = new Date().toISOString();
    } else {
        session.availableCashout = Math.round(session.bet * session.coefficient);
        if (nextRound >= session.gameData.coefficients.length) {
            session.state = 'Win';
            session.endDate = new Date().toISOString();
        }
    }
}

function cashout(session) {
    if (session.state === 'Active' && session.availableCashout > 0) {
        store.user.balance += session.availableCashout;
        session.state = 'Win';
        session.endDate = new Date().toISOString();
    }
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.origin === BACKEND_ORIGIN && url.pathname.startsWith(API_PREFIX)) {
        event.respondWith(handleApi(event.request));
    }
});

async function handleApi(request) {
    const url = new URL(request.url);
    const path = url.pathname; // e.g., /mines/user
    try {
        if (request.method === 'GET' && path === `${API_PREFIX}/user`) {
            return jsonResponse(store.user);
        }
        if (request.method === 'GET' && path === `${API_PREFIX}/settings`) {
            return jsonResponse(store.settings);
        }
        if (request.method === 'GET' && path === `${API_PREFIX}/sessions`) {
            const params = url.searchParams.get('filter');
            let states = [];
            if (params) {
                try { states = JSON.parse(params).states || []; } catch {}
            }
            const data = [];
            if (!states.length || states.includes('Inactive')) {
                data.push(...store.sessions);
            }
            if (!states.length || states.includes('Active')) {
                if (store.activeSession) data.unshift(store.activeSession);
            }
            return jsonResponse({ limit: 30, offset: 0, data });
        }
        if (request.method === 'GET' && path.startsWith(`${API_PREFIX}/session/`) && path.endsWith('/stats')) {
            return jsonResponse({});
        }
        if (request.method === 'GET' && path.startsWith(`${API_PREFIX}/session/`)) {
            const id = path.split('/').pop();
            const s = (store.activeSession && store.activeSession.id === id) ? store.activeSession : store.sessions.find(x => x.id === id);
            if (!s) return jsonResponse({ error: { type: 'notFound' } }, 404);
            const { _internal, ...publicSession } = s;
            return jsonResponse(publicSession);
        }
        if (request.method === 'POST' && path === `${API_PREFIX}/session`) {
            const body = await request.clone().json().catch(() => ({}));
            const amount = Number(body.amount || 0);
            const presetValue = Number(body.presetValue || 3);
            const qb = store.settings.bets[store.user.currency]?.quickBets || { min: 1, max: 100 };
            if (amount < qb.min) {
                return jsonResponse({ error: { type: 'smallBid', header: 'Rate below the minimum', message: 'Rate below the minimum' } }, 400);
            }
            if (amount > qb.max) {
                return jsonResponse({ error: { type: 'highBid', header: 'Rate above the maximum', message: 'Rate above the maximum' } }, 400);
            }
            if (amount > store.user.balance) {
                return jsonResponse({ error: { type: 'insufficientFunds', header: 'Insufficient funds', message: 'Insufficient funds' } }, 400);
            }
            // If active session exists, reject
            if (store.activeSession && store.activeSession.state === 'Active') {
                return jsonResponse({ error: { type: 'activeSessionExists', header: 'Active session already exists', message: 'Active session already exists' } }, 400);
            }
            store.user.balance -= amount;
            const session = buildSession({ amount, presetValue });
            store.activeSession = session;
            const { _internal, ...publicSession } = session;
            return jsonResponse(publicSession);
        }
        if (request.method === 'PUT' && path === `${API_PREFIX}/round`) {
            if (!store.activeSession) return jsonResponse({ error: { type: 'sessionExpired', message: 'Session expired' } }, 400);
            const body = await request.clone().json().catch(() => ({}));
            const click = { col: Number(body.col), row: Number(body.row) };
            // Prevent duplicate same cell
            if (store.activeSession.gameData.userChoices.some(c => c.value.col === click.col && c.value.row === click.row)) {
                return jsonResponse({ error: { type: 'duplicateRound', message: 'Round with this column and row already exists' } }, 400);
            }
            finishRound(store.activeSession, click);
            const finished = (store.activeSession.state === 'Loss' || store.activeSession.state === 'Win');
            if (finished) {
                // Move to history
                const done = store.activeSession;
                store.sessions.unshift(stripInternal(done));
                store.activeSession = null;
            }
            const responseSession = store.activeSession ? stripInternal(store.activeSession) : stripInternal(store.sessions[0]);
            return jsonResponse(responseSession);
        }
        if (request.method === 'PUT' && path.startsWith(`${API_PREFIX}/session/`)) {
            const id = path.split('/').pop();
            // Only allow cashout for active session id
            if (!store.activeSession || store.activeSession.id !== id) {
                return jsonResponse({ error: { type: 'invalidState', message: 'Invalid session state for cashout' } }, 400);
            }
            cashout(store.activeSession);
            // Move to history
            const done = store.activeSession;
            store.sessions.unshift(stripInternal(done));
            store.activeSession = null;
            return jsonResponse(stripInternal(done));
        }
        // Fallback: not found
        return jsonResponse({ error: { type: 'notFound' } }, 404);
    } catch (e) {
        return jsonResponse({ error: { type: 'serverError', message: 'Internal error' } }, 500);
    }
}

function stripInternal(s) {
    const { _internal, ...rest } = s;
    return rest;
}








