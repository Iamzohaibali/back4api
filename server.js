const express = require('express');
const cors = require('cors');
const cluster = require('cluster');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
    origin: isProduction ? process.env.ALLOWED_ORIGINS?.split(',') || '*' : '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API endpoints
app.get('/api/data', (req, res) => {
    const simpleObject = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        message: "Hello from the backend!",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(simpleObject);
});

app.get('/api/user', (req, res) => {
    res.json({
        userId: 123,
        username: "johndoe",
        isActive: true,
        createdAt: "2024-01-15T10:30:00Z",
        serverInfo: {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage()
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: "OK", 
        message: "Server is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: isProduction ? 'Something went wrong' : err.message
    });
});

// Cluster mode for production
if (isProduction && cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(`Master ${process.pid} setting up ${numCPUs} workers`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Handle worker crashes
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    // Workers share the TCP connection
    const server = app.listen(PORT, () => {
        console.log(`Worker ${process.pid} started - Server running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM signal received: closing HTTP server');
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });
}