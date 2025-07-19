require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : ['http://localhost:5173', 'http://192.168.100.7:5173']
);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Basic route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server');
});

// In-memory user tracking
const users = {};
const userRooms = {}; // socket.id -> room name
// In-memory room message history: { room: [ {text, sender, timestamp, ...} ] }
const roomHistories = {}; // Only stores last 7 days of messages
// In-memory room list
let rooms = ['General'];

function broadcastRooms() {
  io.emit('room_list', rooms);
}

function broadcastOnlineUsers() {
  io.emit('online_users', Object.values(users));
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  // Send current room list to new client
  socket.emit('room_list', rooms);

  // Listen for username set event
  socket.on('set_username', (username) => {
    users[socket.id] = username;
    console.log(`User set username: ${username} (${socket.id})`);
    broadcastOnlineUsers();
    io.emit('user_joined', username);
  });

  // Listen for chat messages
  socket.on('chat_message', (msg) => {
    console.log('Received chat_message from', socket.id, msg);
    // Ensure sender and timestamp are set
    const message = {
      text: msg.text,
      sender: msg.sender || users[socket.id] || 'Anonymous',
      timestamp: msg.timestamp || new Date().toISOString(),
      file: msg.file || null,
    };
    io.emit('chat_message', message); // Broadcast to all clients
    console.log('Broadcasted chat_message:', message);
  });

  // Listen for private messages
  socket.on('private_message', ({ to, text, timestamp, file }) => {
    const from = users[socket.id];
    if (!from || !to || (!text && !file)) return;
    // Find recipient socket ID
    const recipientId = Object.keys(users).find(id => users[id] === to);
    if (recipientId) {
      const message = {
        text,
        sender: from,
        recipient: to,
        timestamp: timestamp || new Date().toISOString(),
        file: file || null,
      };
      io.to(recipientId).emit('private_message', message);
      socket.emit('private_message', message); // Also emit to sender
    }
  });

  // Typing indicator events
  socket.on('typing', () => {
    const username = users[socket.id];
    if (username) {
      socket.broadcast.emit('typing', username);
    }
  });
  socket.on('stop_typing', () => {
    const username = users[socket.id];
    if (username) {
      socket.broadcast.emit('stop_typing', username);
    }
  });

  // Allow clients to request the current online users
  socket.on('get_online_users', () => {
    socket.emit('online_users', Object.values(users));
  });

  // Create a new room
  socket.on('create_room', (room) => {
    if (room && !rooms.includes(room)) {
      rooms.push(room);
      broadcastRooms();
      console.log(`Room created: ${room}`);
    }
  });

  // Join a room
  socket.on('join_room', (room) => {
    if (userRooms[socket.id]) {
      socket.leave(userRooms[socket.id]);
    }
    userRooms[socket.id] = room;
    socket.join(room);
    socket.emit('joined_room', room);
    // Purge old messages and send last 7 days of messages
    const now = Date.now();
    if (!roomHistories[room]) roomHistories[room] = [];
    roomHistories[room] = roomHistories[room].filter(m => now - new Date(m.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000);
    socket.emit('room_history', roomHistories[room]);
    console.log(`${users[socket.id] || socket.id} joined room: ${room}`);
  });

  // Room message
  socket.on('room_message', (msg) => {
    const room = userRooms[socket.id];
    console.log('Received room_message from', socket.id, msg, 'userRooms:', userRooms);
    if (!room) return;
    const message = {
      text: msg.text,
      sender: users[socket.id] || 'Anonymous',
      room,
      timestamp: msg.timestamp || new Date().toISOString(),
      file: msg.file || null,
    };
    // Store in history and purge old
    if (!roomHistories[room]) roomHistories[room] = [];
    const now = Date.now();
    roomHistories[room] = roomHistories[room].filter(m => now - new Date(m.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000);
    roomHistories[room].push(message);
    io.to(room).emit('room_message', message);
    console.log('Broadcasted room_message to', room, ':', message);
  });

  // Message reactions
  socket.on('react_message', ({ room, messageIdx, reaction, isPrivate, to }) => {
    if (isPrivate && to) {
      // Private message reaction
      const from = users[socket.id];
      const recipientId = Object.keys(users).find(id => users[id] === to);
      if (recipientId) {
        io.to(recipientId).emit('message_reaction', { room: to, messageIdx, reaction, user: from, isPrivate: true });
        socket.emit('message_reaction', { room: to, messageIdx, reaction, user: from, isPrivate: true });
      }
    } else if (room) {
      // Room message reaction
      io.to(room).emit('message_reaction', { room, messageIdx, reaction, user: users[socket.id] });
    }
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    console.log('User disconnected:', socket.id, username ? `(${username})` : '');
    delete users[socket.id];
    delete userRooms[socket.id];
    broadcastOnlineUsers();
    if (username) io.emit('user_left', username);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
