# 💬 Real-Time Chat App (Socket.io)

## Overview
A real-time chat application built with React, Express, and Socket.io. Supports global and private messaging, multiple chat rooms, message reactions, typing indicators, online status, and real-time notifications. Designed for both desktop and mobile devices.

## Features
- Username-based login
- Global chat room
- Private messaging (DMs) between users (click username to DM)
- Multiple chat rooms/channels (create/join rooms, real-time sync)
- Message reactions (like, love, etc.)
- Typing indicators
- Online/offline user status
- Real-time notifications (new messages, user join/leave)
- Responsive/mobile-friendly design
- Reconnection logic for network issues
- File/image sharing (send and view attachments)
- Message search (filter messages by text or sender)
- Read receipts (pending/delivered/seen ticks)
- Clean UI with attachment and search icons

## Advanced Features
- **File/Image Sharing:** Attach and send images/files in chat (rooms and DMs)
- **Message Search:** Click the search icon to filter messages in the current chat
- **Unread Message Notifications:** Popup notifications for new messages and user activity
- **Reactions:** React to messages with emojis (in rooms and DMs)
- **Room Sync:** New rooms are visible to all users in real time
- **DMs:** Click a username to open a private chat area

## Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Brian-Masheti/real-time-communication-socket-io.git
   cd real-time-communication-socket-io/chat-app
   ```
2. **Install server dependencies:**
   ```bash
   cd server
   pnpm install
   # or npm install
   ```
3. **Install client dependencies:**
   ```bash
   cd ../client
   pnpm install
   # or npm install
   ```
4. **Start the development servers:**
   ```bash
   # In the server directory
   pnpm run dev
   # or npm run dev
   # In a new terminal, in the client directory
   pnpm run dev
   # or npm run dev
   ```
5. **Open the app:**
   - Visit [http://localhost:5173](http://localhost:5173) in your browser.
   - The backend runs on [http://localhost:5000](http://localhost:5000)

## Usage
- Enter a username to join the chat.
- Use the top buttons to switch between global chat, private messages, and rooms.
- Create or join rooms using the room controls.
- React to messages with emojis.
- Attach and send files/images.
- Click the search icon to filter messages.
- See notifications for new messages and user activity.

## Screenshots

### Login Screen
![Login Screen](public/login.png)

### Room Chat
![Room Chat](public/room.png)

## Deployment (Optional)
- Deploy the server to [Render](https://render.com/), [Railway](https://railway.app/), or [Heroku](https://heroku.com/).
- Deploy the client to [Vercel](https://vercel.com/), [Netlify](https://netlify.com/), or [GitHub Pages](https://pages.github.com/).
- Add your deployed URLs here:
  - **Server:** <server-url>
  - **Client:** <client-url>

## Version Control
- This project uses [GitOK](https://github.com/okwareddevnest/gitok) for streamlined Git workflows.
- To commit and push changes, use:
  ```bash
  commit "Your commit message"
  push
  # or pushall
  ```

## Troubleshooting
- If you see a blank screen after entering your username, check the browser console for React hook errors.
- Ensure both the server (port 5000) and client (port 5173) are running.
- For file uploads, make sure the server's `/uploads` directory is writable.

## Credits
- Built by Brian Masheti for the PLP Feb 2025 Cohort, Week 5 Assignment.
- Powered by React, Express, and Socket.io.
