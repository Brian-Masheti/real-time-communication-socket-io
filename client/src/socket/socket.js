import { io } from 'socket.io-client';

// Initialize Socket.io client
const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
  autoConnect: false, // Connect manually in components
});

export default socket;