const { Store, buildSession, publicSession, archiveAndClearIfFinished } = require('./game-logic');

module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const amount = Number(data.amount || 0);
        const preset = Number(data.presetValue || 3);
        const qb = Store.settings.bets[Store.user.currency]?.quickBets || { min: 1, max: 100 };
        
        // If there is a finished session lingering, archive and clear it
        if (Store.activeSession && Store.activeSession.state !== 'Active') {
          const ended = publicSession(Store.activeSession);
          if (!Store.history.find(s => s.id === ended.id)) { 
            Store.history.unshift(ended); 
          }
          Store.activeSession = null;
          Store.user.sessionId = null;
        }
        
        if (amount < qb.min) { 
          res.status(400).json({ 
            error: { type: 'smallBid', header: 'Rate below the minimum', message: 'Rate below the minimum' } 
          });
          return;
        } 
        
        if (amount > qb.max) { 
          res.status(400).json({ 
            error: { type: 'highBid', header: 'Rate above the maximum', message: 'Rate above the maximum' } 
          });
          return;
        } 
        
        if (amount > Store.user.balance) { 
          res.status(400).json({ 
            error: { type: 'insufficientFunds', header: 'Insufficient funds', message: 'Insufficient funds' } 
          });
          return;
        } 
        
        if (Store.activeSession) { 
          res.status(400).json({ 
            error: { type: 'activeSessionExists', header: 'Active session already exists', message: 'Active session already exists' } 
          });
          return;
        } 
        
        Store.user.balance -= amount; 
        Store.activeSession = buildSession(amount, preset);
        Store.user.sessionId = Store.activeSession.id;
        
        res.status(200).json(publicSession(Store.activeSession));
      } catch (error) {
        res.status(400).json({ error: { type: 'invalidRequest', message: 'Invalid request body' } });
      }
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
