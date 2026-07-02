import "dotenv/config"
import { createServer } from "http";
import { app } from "./app.js";
import { initSocket } from "./socket.js";

const PORT = process.env.PORT || 8080;

// Wrap express in a raw HTTP server so Socket.IO can share the same port.
const server = createServer(app);

// Attach the real-time layer (JWT-authed notification sockets).
initSocket(server);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

server.listen(PORT, '0.0.0.0', () => console.log('up on', PORT));
