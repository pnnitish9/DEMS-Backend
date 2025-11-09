import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";

export const userRoom = (id) => `user:${id}`;

export const initializeSocket = (server) => {
  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  
  const io = new SocketIOServer(server, {
    cors: {
      origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    path: "/socket.io",
    transports: ["websocket", "polling"],
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("No token provided"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      return next();
    } catch (e) {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    try {
      const uid = socket.userId;
      if (uid) {
        socket.join(userRoom(uid));
        socket.emit("connected", { ok: true });
      }
      socket.on("disconnect", () => {
        // automatic room leave handled by socket.io
      });
    } catch (e) {
      // ignore
    }
  });

  return io;
};
