const { Store, cashout, publicSession } = require('./game-logic');

module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Extract session ID from URL path
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  const sessionId = pathParts[pathParts.length - 1];

  if (req.method === 'GET') {
    if (Store.activeSession && Store.activeSession.id === sessionId) {
      res.status(200).json(publicSession(Store.activeSession));
      return;
    }
    
    const found = Store.history.find(s => s.id === sessionId);
    if (found) { 
      res.status(200).json(found); 
      return; 
    }
    
    res.status(404).json({ error: { type: 'notFound' } });
  } else if (req.method === 'PUT') {
    // Cashout
    cashout();
    res.status(200).json(Store.history[0] || {});
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
