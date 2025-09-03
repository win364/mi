module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/manifest+json');
  
  const manifest = {
    name: '1WIN',
    short_name: '1WIN',
    start_url: '/mines/',
    display: 'standalone',
    icons: []
  };
  
  res.status(200).json(manifest);
};
