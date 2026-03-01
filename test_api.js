const http = require('http');

console.log("Testing Token Generation...");
http.get('http://localhost:3000/api/token', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const parsed = JSON.parse(data);
        console.log("Got token:", parsed.token);
        console.log("Expires at:", new Date(parsed.expiresAt).toISOString());

        console.log("\nTesting Registration...");
        const postData = JSON.stringify({ name: 'Alice Smith', token: parsed.token });
        const req = http.request('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                console.log("Register response:", data2);

                console.log("\nTesting Attendance List...");
                http.get('http://localhost:3000/api/attendance', (res3) => {
                    let data3 = '';
                    res3.on('data', chunk => data3 += chunk);
                    res3.on('end', () => {
                        console.log("Attendance List:", data3);
                    });
                });
            });
        });
        req.write(postData);
        req.end();
    });
}).on('error', (e) => {
    console.error("Error fetching token:", e);
});
