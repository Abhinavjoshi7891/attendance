const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
const localIp = getLocalIpAddress();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/logos', express.static(path.join(__dirname, 'logos')));

// Database Setup
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        // Initialize tables
        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            token_used TEXT
        )`);
    }
});

// Dynamic Token State
let currentToken = null;
let tokenExpiresAt = 0;
// 30 seconds is plenty to point the camera and open the link. 
// Once the link is opened, they have unlimited time to fill the form!
const TOKEN_LIFESPAN_MS = 30000;
const activeTokens = new Set(); // Stores tokens that are currently valid to be *opened*

function generateToken() {
    currentToken = crypto.randomBytes(16).toString('hex');
    tokenExpiresAt = Date.now() + TOKEN_LIFESPAN_MS;
    activeTokens.add(currentToken);

    // IMPORTANT: Capture the token value in a local const RIGHT NOW.
    // If we used `currentToken` directly inside setTimeout, it would always
    // delete whatever `currentToken` is 90 seconds LATER (a newer token!).
    // This is the classic JavaScript closure-over-variable bug.
    const tokenToExpire = currentToken;
    setTimeout(() => {
        activeTokens.delete(tokenToExpire);
    }, 90000);

    return { token: currentToken, expiresAt: tokenExpiresAt };
}

// Initial Token
generateToken();

// API Endpoints

// 1. Get current token (Host view uses this)
app.get('/api/token', (req, res) => {
    // If token is expired or about to expire in < 2 seconds, generate a new one
    if (Date.now() > tokenExpiresAt - 2000) {
        generateToken();
    }
    res.json({ token: currentToken, expiresAt: tokenExpiresAt });
});

// 1.5 Validate if a token is fresh (Mobile view uses this immediately on load)
app.post('/api/validate-token', (req, res) => {
    const { token } = req.body;

    // If the token is still in our active set, it was generated recently.
    // In "Classroom Mode", we DO NOT delete the token here because
    // 50 students might be scanning the exact same QR code concurrently.
    // The token will automatically expire after 60 seconds from memory anyway.
    if (activeTokens.has(token)) {
        return res.json({ success: true, message: 'Token valid. You can now fill the form.' });
    } else {
        return res.status(400).json({ success: false, message: 'This QR code has already been scanned or is expired. Please scan the screen again.' });
    }
});

// 2. Register Attendance (Scanner view uses this)
app.post('/api/register', (req, res) => {
    const { name, token } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Name is required' });
    }

    if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // We no longer strictly check tokenExpiresAt here because they might take
    // 2 minutes to type their name. We already checked the token when they
    // first loaded the page via /api/validate-token.

    // Check if user already registered recently (Optional: prevent double tapping)
    // For simplicity, we just allow it, or we can look up if name already exists today.
    db.get(`SELECT * FROM attendance WHERE name = ? AND date(timestamp) = date('now')`, [name], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (row) {
            return res.json({ success: true, message: 'Attendance already recorded for today!' });
        }

        // Insert new record
        db.run(`INSERT INTO attendance (name, token_used) VALUES (?, ?)`, [name, token], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to record attendance' });
            }
            res.json({ success: true, message: 'Attendance successfully recorded!' });
        });
    });
});

// 3. Get Attendance List (For API/Admin View)
app.get('/api/attendance', (req, res) => {
    // We use datetime(timestamp, 'localtime') so the database automatically
    // converts the UTC timestamp into the laptop's local timezone!
    db.all(`SELECT id, name, datetime(timestamp, 'localtime') as local_time FROM attendance ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, data: rows });
    });
});

// 4. Get Server Config
app.get('/api/config', (req, res) => {
    res.json({ ip: localIp });
});

// 5. Export Attendance to CSV
app.get('/api/export', (req, res) => {
    db.all(`SELECT id, name, datetime(timestamp, 'localtime') as local_time FROM attendance ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        let csv = 'ID,Name,Timestamp\\n';
        rows.forEach(row => {
            // Escape quotes in names just in case
            const safeName = row.name.replace(/"/g, '""');
            csv += `${row.id},"${safeName}","${row.local_time}"\\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('Spring_School_Attendance.csv');
        return res.send(csv);
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`Attendance Server is running!`);
    console.log(`- Local Access:   http://localhost:${PORT}`);
    console.log(`- Network Access: http://${localIp}:${PORT}`);
    console.log(`========================================`);
    console.log(`\n>>> IMPORTANT <<<`);
    console.log(`Open the Network Access URL (http://${localIp}:${PORT}) on your laptop`);
    console.log(`so the QR code generates correctly for mobile devices!`);
});
