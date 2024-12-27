const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize Express and Socket.IO
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Atlas Connection
const mongoURI = 'mongodb+srv://mohsinbhai894:mohsinisgood666@cluster0.fdiqf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB Atlas
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas!');
  })
  .catch(err => {
    console.error('Error connecting to MongoDB Atlas:', err);
  });

// Schemas and Models
const messageSchema = new mongoose.Schema({
    username: String,
    message: String,
    room: String,
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

const roomSchema = new mongoose.Schema({
    name: String,
    key: String,
});
const Room = mongoose.model('Room', roomSchema);

// API Endpoint to Retrieve Messages for a Room
app.post('/messages', async (req, res) => {
    const { room, key } = req.body;
    try {
        const validRoom = await Room.findOne({ name: room, key });
        if (!validRoom) return res.status(403).send('Invalid room or key.');

        const messages = await Message.find({ room }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).send('Error retrieving messages');
    }
});

// API Endpoint to Get All Rooms (Filtered by Key)
app.post('/rooms', async (req, res) => {
    const { key } = req.body;
    try {
        const room = await Room.findOne({ key });
        if (!room) return res.status(403).send(null);

        res.json(room);
    } catch (error) {
        res.status(500).send('Error retrieving room');
    }
});

// API Endpoint to Create a New Room
app.post('/createRoom', async (req, res) => {
    const { name, key } = req.body;
    try {
        const newRoom = new Room({ name, key });
        await newRoom.save();
        res.json(newRoom);
    } catch (error) {
        res.status(500).send('Error creating room');
    }
});

// Socket.IO Event Handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for joining a room
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    // Listen for chat messages and broadcast them to the specific room
    socket.on('chatMessage', async (data) => {
        try {
            const newMessage = new Message(data);
            await newMessage.save();
            io.to(data.room).emit('chatMessage', data); // Broadcast to the specific room
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Server Listen
server.listen(3001, () => {
    console.log('Server running on http://localhost:3001');
});
