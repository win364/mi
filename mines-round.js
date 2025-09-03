const { Store, finishRound, publicSession } = require('./game-logic');

module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        if (!Store.activeSession) {
          // When no active session, return neutral payload
          const neutral = {
            userChoices: [],
            state: 'Not started',
            availableCashout: 0,
            coefficient: 0,
            lastRound: 0,
            gameData: {
              currentRoundId: 0,
              availableCashout: false,
              rounds: [],
              coefficients: [],
              expectedChoices: []
            }
          };
          res.status(200).json(neutral);
          return;
        }
        
        const click = { col: Number(data.col), row: Number(data.row) };
        const dup = Store.activeSession.gameData.userChoices.some(c => 
          c.value.col === click.col && c.value.row === click.row
        );
        
        if (dup) { 
          res.status(400).json({ 
            error: { type: 'duplicateRound', message: 'Round with this column and row already exists' } 
          });
          return;
        } 
        
        finishRound(Store.activeSession, click);
        const s = Store.activeSession;
        const payload = {
          userChoices: s.gameData.userChoices,
          state: s.state,
          availableCashout: s.availableCashout || 0,
          coefficient: s.coefficient || 0,
          lastRound: s.lastRound || 0,
          gameData: {
            currentRoundId: s.gameData.currentRoundId,
            availableCashout: s.availableCashout > 0,
            rounds: s.gameData.rounds,
            coefficients: s.gameData.coefficients,
            expectedChoices: s.gameData.expectedChoices
          }
        };
        
        res.status(200).json(payload);
      } catch (error) {
        res.status(400).json({ error: { type: 'invalidRequest', message: 'Invalid request body' } });
      }
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
