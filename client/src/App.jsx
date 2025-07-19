import { useEffect, useState, useRef } from 'react';
import socket from './socket/socket';
import './index.css';

function App() {
  const [username, setUsername] = useState('');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [pendingMessages] = useState([]); // For messages not yet echoed by server
  const messagesEndRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeout = useRef(null);
  const [chatMode, setChatMode] = useState('General'); // room name or username
  const [privateMessages, setPrivateMessages] = useState({}); // { username: [messages] }
  const [rooms, setRooms] = useState(['General']);
  const [currentRoom, setCurrentRoom] = useState('General');
  const [roomMessages, setRoomMessages] = useState({}); // { room: [messages] }
  const [newRoomInput, setNewRoomInput] = useState('');
  const [roomReactions, setRoomReactions] = useState({}); // { room: { messageIdx: { reaction: [users] } } }
  const reactionTypes = ['😁', '👊🏿', '🤛🏿', '🎉', '😌', '🤗', '💋', '🥶', '🤦🏿‍♂️', '👍', '❤️', '😂', '😮'];
  const [openReactionIdx, setOpenReactionIdx] = useState(null); // Which message reactions are open
  const [notifications, setNotifications] = useState([]);
  const addNotification = (msg) => {
    setNotifications((prev) => [...prev, msg]);
    setTimeout(() => {
      setNotifications((prev) => prev.slice(1));
    }, 3500);
  };
  const [showDisconnected, setShowDisconnected] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!username) return;
    // Connect to the Socket.io server
    socket.connect();
    console.log('Connecting to server...');

    // Send username to server
    socket.emit('set_username', username);
    // Automatically join General room on connect
    socket.emit('join_room', 'General');

    // --- CLEANUP ALL LISTENERS FIRST ---
    socket.off();

    // Listen for room list updates
    socket.on('room_list', (roomList) => {
      setRooms(roomList);
    });

    // Listen for connection event
    socket.on('connect', () => {
      setConnected(true);
      setShowDisconnected(false);
      console.log('Connected to server:', socket.id);
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setShowDisconnected(true);
      addNotification('Disconnected from server. Trying to reconnect...');
      console.log('Disconnected from server');
    });
    socket.on('chat_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.sender !== username) addNotification(`New message from ${msg.sender}`);
    });
    socket.on('online_users', (users) => {
      setOnlineUsers(users);
    });
    socket.emit('get_online_users');
    socket.on('typing', (user) => {
      setTypingUsers((prev) => prev.includes(user) ? prev : [...prev, user]);
    });
    socket.on('stop_typing', (user) => {
      setTypingUsers((prev) => prev.filter(u => u !== user));
    });
    socket.on('private_message', (msg) => {
      setPrivateMessages(prev => {
        const otherUser = msg.sender === username ? msg.recipient : msg.sender;
        const msgs = prev[otherUser] || [];
        return { ...prev, [otherUser]: [...msgs, msg] };
      });
      if (msg.sender !== username) addNotification(`New private message from ${msg.sender}`);
    });
    socket.on('room_message', (msg) => {
      setRoomMessages(prev => {
        const msgs = prev[msg.room] || [];
        return { ...prev, [msg.room]: [...msgs, msg] };
      });
      if (msg.sender !== username) addNotification(`New message in #${msg.room} from ${msg.sender}`);
    });
    socket.on('joined_room', (room) => {
      setCurrentRoom(room);
    });
    socket.on('room_history', (history) => {
      // history is an array of messages for the room
      if (history && Array.isArray(history) && history.length > 0 && history[0].room) {
        setRoomMessages(prev => ({ ...prev, [history[0].room]: history }));
      }
    });
    socket.on('message_reaction', ({ room, messageIdx, reaction, user }) => {
      setRoomReactions(prev => {
        const roomObj = prev[room] || {};
        const msgObj = roomObj[messageIdx] || {};
        const users = msgObj[reaction] || [];
        if (users.includes(user)) return prev;
        return {
          ...prev,
          [room]: {
            ...roomObj,
            [messageIdx]: {
              ...msgObj,
              [reaction]: [...users, user],
            },
          },
        };
      });
    });
    socket.on('user_joined', (user) => {
      if (user !== username) addNotification(`${user} joined the chat`);
    });
    socket.on('user_left', (user) => {
      if (user !== username) addNotification(`${user} left the chat`);
    });

    // Cleanup on component unmount or username change
    return () => {
      socket.off();
      socket.disconnect();
    };
  }, [username]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!username) return;
    // For room messages

  }, [roomMessages, privateMessages, username]);


  if (!username) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <form
          className="bg-white p-8 rounded shadow flex flex-col gap-4"
          onSubmit={e => {
            e.preventDefault();
            if (input.trim()) setUsername(input.trim());
          }}
        >
          <h2 className="text-xl font-bold text-blue-600">Enter your username</h2>
          <input
            className="border p-2 rounded"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Username"
            autoFocus
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            type="submit"
          >
            Join
          </button>
        </form>
      </div>
    );
  }

  // --- Event Handlers and Helpers below ---

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) {
      socket.emit('typing');
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('stop_typing');
      }, 2000);
    } else {
      socket.emit('stop_typing');
    }
  };

  

  const handleRoomSend = async (e) => {
    e.preventDefault();
    let fileUrl = null;
    if (file) {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('http://localhost:5000/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        fileUrl = data.url;
      } catch {
        addNotification('File upload failed');
      }
      setUploading(false);
      setFile(null);
    }
    if (messageInput.trim() || fileUrl) {
      if (rooms.includes(chatMode)) {
        // Room message
        const msg = {
          text: messageInput,
          room: currentRoom,
          timestamp: new Date().toISOString(),
          file: fileUrl,
        };
        socket.emit('room_message', msg);
        setRoomMessages(prev => {
          const msgs = prev[currentRoom] || [];
          return { ...prev, [currentRoom]: [...msgs, { ...msg, sender: username }] };
        });
      } else {
        // Private message
        const msg = {
          text: messageInput,
          to: chatMode,
          timestamp: new Date().toISOString(),
          file: fileUrl,
        };
        socket.emit('private_message', msg);
        setPrivateMessages(prev => {
          const msgs = prev[chatMode] || [];
          return { ...prev, [chatMode]: [...msgs, { ...msg, sender: username, recipient: chatMode }] };
        });
      }
      setMessageInput('');
      socket.emit('stop_typing');
    }
  };

  const handleAddRoom = (e) => {
    e.preventDefault();
    const room = newRoomInput.trim();
    if (room && !rooms.includes(room)) {
      socket.emit('create_room', room); // Tell server to create and broadcast
      setCurrentRoom(room);
      socket.emit('join_room', room);
      setNewRoomInput('');
    }
  };

  const handleReact = (room, idx, reaction) => {
    socket.emit('react_message', { room, messageIdx: idx, reaction });
  };

  const chatUsers = onlineUsers.filter(u => u !== username);
  
  // Determine which messages to show
  let displayedMessages = [];
  let inputPlaceholder = '';
  if (rooms.includes(chatMode)) {
    // Room chat (including General)
    const seen = new Set();
    displayedMessages = (roomMessages[chatMode] || []).filter(msg => {
      const key = msg.sender + msg.timestamp + msg.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    inputPlaceholder = `Message #${chatMode}`;
  } else {
    // Private chat
    const seen = new Set();
    displayedMessages = (privateMessages[chatMode] || []).filter(msg => {
      const key = msg.sender + msg.timestamp + msg.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    inputPlaceholder = `Message @${chatMode}`;
  }

    // Filter messages by search term
  const filteredMessages = searchTerm.trim()
    ? displayedMessages.filter(msg =>
        (msg.text && msg.text.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (msg.sender && msg.sender.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : displayedMessages;

  // Merge displayedMessages with pendingMessages for your own messages
  let mergedMessages = [...displayedMessages];
  if (pendingMessages.length > 0) {
    pendingMessages.forEach((p) => {
      if (p.sender === username) mergedMessages.push(p);
    });
    // Sort by timestamp
    mergedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Disconnected banner */}
      {showDisconnected && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-50">
          Disconnected from server. Trying to reconnect...
        </div>
      )}
      {/* Notifications */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {notifications.map((n, i) => (
          <div key={i} className="bg-blue-600 text-white px-4 py-2 rounded shadow-lg animate-fade-in-out text-center min-w-[200px] max-w-xs sm:max-w-md pointer-events-auto">
            {n}
          </div>
        ))}
      </div>
      <h1 className="text-2xl font-bold text-blue-600 mb-2">Welcome, {username}!</h1>
      <div className="mb-2 text-gray-700">
        Online: {onlineUsers.map(user => (
          <button
            key={user}
            className={`inline-block mx-1 px-2 py-1 rounded ${chatMode === user ? 'bg-blue-200 text-blue-800 font-bold' : 'hover:bg-blue-100'} ${user === username ? 'bg-green-100 text-green-700 cursor-default' : 'cursor-pointer'}`}
            disabled={user === username}
            onClick={() => {
              if (user !== username) setChatMode(user);
            }}
            title={user === username ? 'You' : `DM ${user}`}
          >
            {user}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 mb-2 justify-center">
        {rooms.map(room => (
          <button
            key={room}
            className={`px-3 py-1 rounded ${chatMode === room ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
            onClick={() => { setCurrentRoom(room); setChatMode(room); socket.emit('join_room', room); }}
          >
            {room}
          </button>
        ))}
        {chatUsers.map(u => (
          <button
            key={u}
            className={`px-3 py-1 rounded ${chatMode === u ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setChatMode(u)}
          >
            {u}
          </button>
        ))}
      </div>
      {/* Room controls */}
      <div className="flex flex-wrap gap-2 mb-2 justify-center">
        {rooms.map(room => (
          <button
            key={room}
            className={`px-3 py-1 rounded ${currentRoom === room ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
            onClick={() => { setCurrentRoom(room); setChatMode(room); socket.emit('join_room', room); }}
          >
            {room}
          </button>
        ))}
        <form onSubmit={handleAddRoom} className="flex gap-1">
          <input
            className="border p-1 rounded"
            type="text"
            value={newRoomInput}
            onChange={e => setNewRoomInput(e.target.value)}
            placeholder="New room"
          />
          <button className="bg-green-600 text-white px-2 rounded" type="submit">+</button>
        </form>
      </div>
      {/* Chat UI */}
      <div className="bg-white w-full max-w-md rounded shadow p-2 sm:p-4 flex flex-col h-[60vh] min-h-[400px] min-w-[90vw] sm:min-w-[350px] md:min-w-[400px] lg:min-w-[500px]">
        {/* Message search icon and bar */}
        <div className="mb-2 flex items-center gap-2 min-h-[32px]">
          {!showSearch ? (
            <button
              className="relative group"
              onClick={() => setShowSearch(true)}
              title="Search messages"
              type="button"
            >
              {/* Magnifying glass icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-gray-500 hover:text-blue-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                Search messages
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                className="border rounded p-1 flex-1"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
              <button
                className="text-xs text-gray-500 hover:text-red-600"
                onClick={() => { setSearchTerm(''); setShowSearch(false); }}
                title="Close search"
                type="button"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto mb-2">
          {filteredMessages.map((msg, idx) => {
            const isMine = msg.sender === username;

            // Ticks styles
            function getMessageStatus(msg) {
              if (!isMine) return null;
              // Pending: still in pendingMessages
              if (pendingMessages.some(p =>
                p.sender === msg.sender &&
                p.text === msg.text &&
                Math.abs(new Date(p.timestamp) - new Date(msg.timestamp)) < 2000
              )) {
                return 'pending';
              }
              // Delivered: message is in messages/roomMessages/privateMessages
              // Seen: recipient is online and this is the latest message to them
              if (chatMode !== username && onlineUsers.includes(chatMode)) {
                // If last message in this chat is from me, mark as seen
                const chatMsgs = rooms.includes(chatMode) ? (roomMessages[chatMode] || []) : (privateMessages[chatMode] || []);
                const myMsgs = chatMsgs.filter(m => m.sender === username);
                if (myMsgs.length && myMsgs[myMsgs.length - 1].text === msg.text && myMsgs[myMsgs.length - 1].timestamp === msg.timestamp) {
                  return 'seen';
                }
              }
              return 'delivered';
            }
            const status = getMessageStatus(msg);

            return (
              <div
                key={msg.timestamp + '-' + msg.sender + '-' + msg.text}
                className={`mb-2 flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className="rounded-lg px-3 py-2 max-w-xs sm:max-w-md break-words shadow-md relative">
                  <span className={rooms.includes(chatMode) ? 'font-semibold text-green-700' : 'font-semibold text-purple-700'}>
                    {msg.sender}
                  </span>
                  {/* Reaction menu toggle */}
                  <button
                    className="ml-2 text-gray-400 hover:text-gray-700 focus:outline-none"
                    onClick={() => setOpenReactionIdx(openReactionIdx === idx ? null : idx)}
                    title="Show reactions"
                  >
                    &#x25BE; {/* Down arrow */}
                  </button>
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                    {isMine && status === 'pending' && (
                      <svg className="inline w-4 h-4 ml-1 text-gray-400" viewBox="0 0 24 24"><path fill="currentColor" d="M20 6L9 17l-5-5"/></svg>
                    )}
                    {isMine && status === 'delivered' && (
                      <span className="inline-block ml-1">
                        <svg className="inline w-4 h-4 text-gray-400" viewBox="0 0 24 24"><path fill="currentColor" d="M17 7l-7.5 7.5-3.5-3.5"/></svg>
                        <svg className="inline w-4 h-4 -ml-2 text-gray-400" viewBox="0 0 24 24"><path fill="currentColor" d="M20 6L9 17l-5-5"/></svg>
                      </span>
                    )}
                    {isMine && status === 'seen' && (
                      <span className="inline-block ml-1">
                        <svg className="inline w-4 h-4 text-blue-500" viewBox="0 0 24 24"><path fill="currentColor" d="M17 7l-7.5 7.5-3.5-3.5"/></svg>
                        <svg className="inline w-4 h-4 -ml-2 text-blue-500" viewBox="0 0 24 24"><path fill="currentColor" d="M20 6L9 17l-5-5"/></svg>
                      </span>
                    )}
                  </span>
                  <div className="ml-2 break-words max-w-xs sm:max-w-full">
                    {msg.text}
                    {msg.file && (
                      <div className="mt-2">
                        {msg.file.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <img src={`http://localhost:5000${msg.file}`} alt="attachment" className="max-h-40 rounded" />
                        ) : (
                          <a href={`http://localhost:5000${msg.file}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Download file</a>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Show reactions only if openReactionIdx === idx */}
                  {openReactionIdx === idx && (
                    <div className="flex gap-1 mt-1 flex-wrap bg-gray-50 rounded p-1 shadow">
                      {reactionTypes.map(r => (
                        <button
                          key={r}
                          className="text-lg hover:scale-110 transition-transform"
                          onClick={() => handleReact(rooms.includes(chatMode) ? chatMode : currentRoom, idx, r)}
                          title={`React with ${r}`}
                        >
                          {r}
                          <span className="text-xs ml-1">
                            {roomReactions[rooms.includes(chatMode) ? chatMode : currentRoom]?.[idx]?.[r]?.length || ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Show who reacted (optional) */}
                  {roomReactions[rooms.includes(chatMode) ? chatMode : currentRoom]?.[idx] && (
                    <div className="text-xs text-gray-500 mt-1">
                      {Object.entries(roomReactions[rooms.includes(chatMode) ? chatMode : currentRoom][idx]).map(([r, users]) =>
                        users.length > 0 ? (
                          <span key={r} className="mr-2">
                            {r}: {users.join(', ')}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
        })}
        <div ref={messagesEndRef} />
        {typingUsers.length > 0 && chatMode === 'General' && (
          <div className="text-xs text-gray-500 mb-1">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        </div> {/* Close flex-1 overflow-y-auto mb-2 */}
        <form className="flex gap-2" onSubmit={handleRoomSend}>
          <input
            className="flex-1 border p-2 rounded"
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            placeholder={inputPlaceholder}
            autoFocus
          />
          <div className="relative flex items-center">
            <input
              id="file-input"
              type="file"
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => setFile(e.target.files[0])}
              className="hidden"
              disabled={uploading}
            />
            <label htmlFor="file-input" className="cursor-pointer flex items-center group">
              {/* Paperclip SVG icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-gray-500 hover:text-blue-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75V7.5a4.5 4.5 0 10-9 0v7.5a6 6 0 0012 0V9.75"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                Attach a file
              </span>
            </label>
          </div>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            type="submit"
            disabled={!connected || (!messageInput.trim() && !file) || uploading}
          >
            {uploading ? 'Uploading...' : 'Send'}
          </button>
        </form>
      </div>
      {/* Close bg-white w-full max-w-md rounded shadow p-2 sm:p-4 flex flex-col h-[60vh] min-h-[400px] lg:min-w-[500px] */}
      {/* Close bg-gray-100 min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 */}
    </div>
  );
}
export default App;