const http = require('http');

/**
 * Simple health check server for deployment monitoring
 * @param {number} port - Port to run the health check server on
 */
const startHealthCheck = (port = 3000) => {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(port, () => {
        console.log(`Health check server running on port ${port}`);
    });

    return server;
};

module.exports = { startHealthCheck }; 