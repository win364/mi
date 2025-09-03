// Game logic module for Mines game
const crypto = require('crypto');

// In-memory store (in production, use a database)
let Store = {
  user: { 
    language: 'ru', 
    currency: 'RUB', 
    sessionId: null, 
    balance: 1000.00, 
    name: 'Player', 
    avatar: '', 
    exchangeRate: 1 
  },
  settings: {
    supportedCurrencies: ['RUB'],
    bets: { RUB: { quickBets: { min: 1, max: 20000 }, defaultBet: 100, steps: [] } },
    presets: [{ presetValue: 3, isDefault: true }],
    rates: [{ presetValue: 3, rates: [1.09,1.24,1.43,1.65,1.93,2.27,2.69,3.23,3.92] }],
    roundsCount: 25,
  },
  activeSession: null,
  history: [],
};

function getRates(preset) {
  const e = (Store.settings.rates||[]).find(r=>r.presetValue===preset);
  return e ? e.rates.slice() : [];
}

function randomBombs(traps) {
  const set = new Set();
  while (set.size < Math.min(traps,25)) {
    const col = Math.floor(Math.random()*5); 
    const row = Math.floor(Math.random()*5);
    set.add(`${col},${row}`);
  }
  const expectedChoices = [];
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) 
    expectedChoices.push({ value:{col:c,row:r}, category: set.has(`${c},${r}`)?1:0 });
  return { bombs:set, expectedChoices };
}

function bombMatrixFromSet(bombs) {
  const m = Array.from({length:5},()=>Array(5).fill(0));
  for (let r=0;r<5;r++) for (let c=0;c<5;c++) { 
    if (bombs.has(`${c},${r}`)) m[r][c]=1; 
  }
  return m;
}

function generateSaltAndHash(bombs) {
  const left = Math.random().toString(16).slice(2);
  const right = Math.random().toString(16).slice(2);
  const matrix = bombMatrixFromSet(bombs);
  const salt = `${left}|${JSON.stringify(matrix)}|${right}`;
  const hash = crypto.createHash('sha256').update(salt).digest('hex');
  return { salt, hash };
}

function buildSession(amount, presetValue) {
  const id = Math.random().toString(36).slice(2)+Date.now().toString(36);
  const { bombs, expectedChoices } = randomBombs(presetValue||3);
  const { salt, hash } = generateSaltAndHash(bombs);
  const coeffs = getRates(presetValue||3);
  return {
    id, state:'Active', bet:amount, hash, salt, lastRound:0, coefficient:0, availableCashout:0,
    startDate:new Date().toISOString(), endDate:'', currency:Store.user.currency,
    gameData:{ presetValue:presetValue||3, coefficients:coeffs, userChoices:[], expectedChoices, currentRoundId:0, rounds:[{id:0,amount:0,availableCash:0,odd:1}] },
    _internal:{ bombs }
  };
}

function finishRound(session, click){
  const key = `${click.col},${click.row}`; 
  const isBomb = session._internal.bombs.has(key);
  const next = session.lastRound + 1; 
  const coeff = session.gameData.coefficients[Math.max(0,next-1)] || session.coefficient || 0;
  
  session.gameData.userChoices.push({ value:{col:click.col,row:click.row}, category: isBomb?1:0 });
  session.lastRound = next; 
  session.coefficient = isBomb ? session.coefficient : coeff;
  
  // advance round counters/rounds list
  session.gameData.currentRoundId = next;
  session.gameData.rounds.push({ 
    id: next, 
    amount: session.bet, 
    availableCash: Math.round(session.bet * (isBomb? session.coefficient : coeff)), 
    odd: session.coefficient 
  });
  
  if (isBomb) { 
    session.state='Loss'; 
    session.availableCashout=0; 
    session.endDate=new Date().toISOString(); 
  } else { 
    session.availableCashout = Math.round(session.bet * session.coefficient); 
    if (next>=session.gameData.coefficients.length){ 
      session.state='Win'; 
      session.endDate=new Date().toISOString(); 
      // Auto-credit balance for full win
      if (!session._internal.paid) {
        Store.user.balance = Math.round((Store.user.balance + session.availableCashout) * 100) / 100;
        session._internal.paid = true;
      }
    } 
  }
}

function cashout(){
  const s = Store.activeSession;
  if(!s) return;
  if(s.state==='Active'&&s.availableCashout>0){ 
    Store.user.balance = Math.round((Store.user.balance + s.availableCashout) * 100) / 100; 
    s.state='Win'; 
    s.endDate=new Date().toISOString(); 
  }
  Store.history.unshift(publicSession(s));
  Store.activeSession = null;
}

function publicSession(s){ 
  if(!s) return {}; 
  const {_internal,...rest}=s; 
  return rest; 
}

function archiveAndClearIfFinished(){
  const s = Store.activeSession;
  if (!s) return;
  if (s.state && s.state !== 'Active') {
    const ended = publicSession(s);
    if (!Store.history.find(h => h.id === ended.id)) {
      Store.history.unshift(ended);
    }
    Store.activeSession = null;
    Store.user.sessionId = null;
  }
}

module.exports = {
  Store,
  buildSession,
  finishRound,
  cashout,
  publicSession,
  archiveAndClearIfFinished
};
