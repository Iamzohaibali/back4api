const express = require('express');
const cors = require('cors');
const cluster = require('cluster');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// In-memory data store (replace with database in production)
let todos = [
    { id: 1, title: 'Learn Express.js', completed: false, createdAt: new Date().toISOString() },
    { id: 2, title: 'Deploy to Back4app', completed: false, createdAt: new Date().toISOString() }
];

let users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'user' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'admin' }
];

// CORS configuration - Allow all origins for maximum accessibility
const corsOptions = {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 200,
    preflightContinue: false,
    maxAge: 86400 // Cache preflight requests for 24 hours
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Additional security headers to ensure accessibility
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    
    // Log response time on finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
});

// ============= USEFUL ROUTES =============

/**
 * 1. TODO API - Complete CRUD operations
 */
// Get all todos
app.get('/api/todos', (req, res) => {
    const { completed, limit = 10, page = 1 } = req.query;
    let filteredTodos = [...todos];
    
    // Filter by completion status
    if (completed !== undefined) {
        filteredTodos = filteredTodos.filter(t => t.completed === (completed === 'true'));
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTodos = filteredTodos.slice(startIndex, endIndex);
    
    res.json({
        data: paginatedTodos,
        pagination: {
            total: filteredTodos.length,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(filteredTodos.length / limit)
        }
    });
});

// Get single todo
app.get('/api/todos/:id', (req, res) => {
    const todo = todos.find(t => t.id === parseInt(req.params.id));
    
    if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
    }
    
    res.json(todo);
});

// Create todo
app.post('/api/todos', (req, res) => {
    const { title } = req.body;
    
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'Title is required' });
    }
    
    const newTodo = {
        id: todos.length + 1,
        title: title.trim(),
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    todos.push(newTodo);
    res.status(201).json(newTodo);
});

// Update todo
app.put('/api/todos/:id', (req, res) => {
    const todo = todos.find(t => t.id === parseInt(req.params.id));
    
    if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
    }
    
    const { title, completed } = req.body;
    
    if (title !== undefined) todo.title = title.trim();
    if (completed !== undefined) todo.completed = completed;
    todo.updatedAt = new Date().toISOString();
    
    res.json(todo);
});

// Delete todo
app.delete('/api/todos/:id', (req, res) => {
    const index = todos.findIndex(t => t.id === parseInt(req.params.id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'Todo not found' });
    }
    
    todos.splice(index, 1);
    res.status(204).send();
});

/**
 * 2. User Management API
 */
// Get all users
app.get('/api/users', (req, res) => {
    const { role } = req.query;
    let filteredUsers = [...users];
    
    if (role) {
        filteredUsers = filteredUsers.filter(u => u.role === role);
    }
    
    res.json(filteredUsers);
});

// Get user by ID
app.get('/api/users/:id', (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
});

// Create user
app.post('/api/users', (req, res) => {
    const { name, email, role = 'user' } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // Check if email already exists
    if (users.some(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }
    
    const newUser = {
        id: users.length + 1,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    res.status(201).json(newUser);
});

// Update user
app.put('/api/users/:id', (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const { name, email, role } = req.body;
    
    if (name) user.name = name.trim();
    if (email) {
        // Check if email already exists for another user
        if (users.some(u => u.email === email && u.id !== user.id)) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        user.email = email.toLowerCase().trim();
    }
    if (role) user.role = role;
    user.updatedAt = new Date().toISOString();
    
    res.json(user);
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    const index = users.findIndex(u => u.id === parseInt(req.params.id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    users.splice(index, 1);
    res.status(204).send();
});

/**
 * 3. Search API
 */
app.get('/api/search', (req, res) => {
    const { q, type = 'all' } = req.query;
    
    if (!q || q.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const query = q.toLowerCase();
    let results = [];
    
    if (type === 'all' || type === 'todos') {
        const todoResults = todos.filter(t => 
            t.title.toLowerCase().includes(query)
        ).map(t => ({ ...t, type: 'todo' }));
        results = results.concat(todoResults);
    }
    
    if (type === 'all' || type === 'users') {
        const userResults = users.filter(u => 
            u.name.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query)
        ).map(u => ({ ...u, type: 'user' }));
        results = results.concat(userResults);
    }
    
    res.json({
        query: q,
        type,
        count: results.length,
        results
    });
});

/**
 * 4. Utility APIs
 */
// Get server stats
app.get('/api/stats', (req, res) => {
    res.json({
        server: {
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        },
        data: {
            todos: todos.length,
            users: users.length,
            completedTodos: todos.filter(t => t.completed).length
        },
        timestamp: new Date().toISOString()
    });
});

// Generate random data
app.get('/api/random/:type', (req, res) => {
    const { type } = req.params;
    const { count = 1 } = req.query;
    
    const randomData = [];
    const numCount = Math.min(parseInt(count), 100); // Limit to 100 items
    
    for (let i = 0; i < numCount; i++) {
        switch(type) {
            case 'numbers':
                randomData.push({
                    id: i + 1,
                    value: Math.floor(Math.random() * 1000),
                    timestamp: new Date().toISOString()
                });
                break;
            case 'strings':
                randomData.push({
                    id: i + 1,
                    value: crypto.randomBytes(8).toString('hex'),
                    timestamp: new Date().toISOString()
                });
                break;
            case 'users':
                randomData.push({
                    id: i + 1,
                    name: `User${Math.floor(Math.random() * 1000)}`,
                    email: `user${Math.floor(Math.random() * 1000)}@example.com`,
                    role: ['admin', 'user', 'guest'][Math.floor(Math.random() * 3)],
                    timestamp: new Date().toISOString()
                });
                break;
            default:
                return res.status(400).json({ error: 'Invalid type. Use: numbers, strings, users' });
        }
    }
    
    res.json({
        type,
        count: numCount,
        data: randomData
    });
});

/**
 * 5. Authentication simulation (useful for testing)
 */
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Simulate authentication (never do this in production!)
    const user = users.find(u => u.email === email);
    
    if (!user || password !== 'password123') { // Demo only!
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({
        message: 'Login successful',
        user: { ...user, password: undefined },
        token: crypto.randomBytes(32).toString('hex'), // Mock token
        expiresIn: 3600
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

/**
 * 6. File upload simulation
 */
app.post('/api/upload', (req, res) => {
    const { filename, size, type } = req.body;
    
    if (!filename) {
        return res.status(400).json({ error: 'Filename required' });
    }
    
    // Simulate file upload
    res.json({
        message: 'File uploaded successfully',
        file: {
            id: crypto.randomBytes(8).toString('hex'),
            filename,
            size: size || 0,
            type: type || 'unknown',
            url: `https://storage.example.com/${filename}`,
            uploadedAt: new Date().toISOString()
        }
    });
});

/**
 * 7. Weather API simulation
 */
app.get('/api/weather/:city', (req, res) => {
    const { city } = req.params;
    const { units = 'metric' } = req.query;
    
    // Simulate weather data
    const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Snowy'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const temperature = units === 'metric' 
        ? Math.floor(Math.random() * 35) 
        : Math.floor(Math.random() * 95);
    
    res.json({
        city: city.charAt(0).toUpperCase() + city.slice(1),
        condition: randomCondition,
        temperature: {
            value: temperature,
            units: units === 'metric' ? '°C' : '°F'
        },
        humidity: Math.floor(Math.random() * 100),
        windSpeed: Math.floor(Math.random() * 50),
        forecast: [
            { day: 'Tomorrow', condition: 'Sunny', high: temperature + 2, low: temperature - 5 },
            { day: 'Day After', condition: 'Cloudy', high: temperature + 1, low: temperature - 3 }
        ],
        timestamp: new Date().toISOString()
    });
});

// Original routes (keeping for backward compatibility)
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

// API documentation route
app.get('/', (req, res) => {
    res.json({
        name: "Express.js Backend API",
        version: "1.0.0",
        description: "A feature-rich Express.js backend for Back4app",
        cors: {
            enabled: true,
            allowedOrigins: "*",
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        },
        endpoints: {
            todos: {
                "GET /api/todos": "Get all todos (with filtering and pagination)",
                "GET /api/todos/:id": "Get single todo",
                "POST /api/todos": "Create new todo",
                "PUT /api/todos/:id": "Update todo",
                "DELETE /api/todos/:id": "Delete todo"
            },
            users: {
                "GET /api/users": "Get all users",
                "GET /api/users/:id": "Get user by ID",
                "POST /api/users": "Create user",
                "PUT /api/users/:id": "Update user",
                "DELETE /api/users/:id": "Delete user"
            },
            search: {
                "GET /api/search?q=:query": "Search across todos and users"
            },
            utilities: {
                "GET /api/stats": "Get server statistics",
                "GET /api/random/:type": "Generate random data",
                "GET /api/weather/:city": "Get weather for a city"
            },
            auth: {
                "POST /api/auth/login": "Simulate login",
                "POST /api/auth/logout": "Simulate logout"
            },
            files: {
                "POST /api/upload": "Simulate file upload"
            },
            original: {
                "GET /api/data": "Original simple object",
                "GET /api/user": "Original user endpoint"
            }
        },
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.path}`,
        availableEndpoints: '/ for documentation'
    });
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
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Worker ${process.pid} started - Server running on port ${PORT}`);
        console.log(`Documentation available at http://localhost:${PORT}`);
        console.log(`CORS is enabled for all origins - API accessible from any frontend`);
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