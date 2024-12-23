const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.get('/', (req, res) => {
    res.send('Server is running...');
});

// Function to validate JSON
// const isValidJson = (str) => {
//     try {
//         JSON.parse(str);
//         return true;
//     } catch (e) {
//         return false;
//     }
// };

// Start tshark process
const startTshark = () => {
    // Use the loopback interface ('lo') for capturing all traffic
    const tshark = spawn('tshark', ['-i', 'lo', '-T', 'json']);
    
    let buffer = ''; // Accumulate data in a buffer

    tshark.stdout.on('data', (data) => {
        buffer += data.toString(); // Append new data to the buffer

        let lines = buffer.split('\n'); // Split buffer into lines
        buffer = lines.pop(); // Save incomplete line back to buffer

        lines.forEach((line) => {
            if (line.trim()) {
                // Try parsing the JSON
                try {
                    if (isValidJson(line)) {
                        const packet = JSON.parse(line);
                        io.emit('packetData', packet); // Broadcast to clients
                    } else {
                        // Handle invalid JSON (partial JSON object)
                        console.warn('Partial or invalid JSON data:', line);
                    }
                } catch (err) {
                    console.error('Error parsing JSON:', err);
                }
            }
        });
    });

    tshark.stderr.on('data', (data) => {
        console.log('tshark :', data.toString());
    });

    tshark.on('close', (code) => {
        console.log(`tshark process exited with code ${code}`);
    });

    return tshark;
};

let tsharkProcess = startTshark();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for chat messages and broadcast them to all connected clients
    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', data); // Broadcast the message to all users
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3001, () => {
    console.log('Server running on http://localhost:3001');
});

// Stop tshark process on server exit
process.on('SIGINT', () => {
    tsharkProcess.kill();
    process.exit();
});
