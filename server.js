import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { connectDB } from "./config/db.js";
import { initializeSocket } from "./config/socket.js";
import { setSocketIO } from "./utils/sendNotification.js";

import authRoutes from "./routes/authRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Database
connectDB();

// Socket.IO
const io = initializeSocket(server);
app.set("io", io);
setSocketIO(io);

// Routes
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "DEMS API",
    version: "1.0",
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// Start server
server.listen(PORT, () => {
  console.log(`Server with Socket.IO running at http://localhost:${PORT}`);
  console.log(`Socket.IO path: /socket.io`);
  console.log(`CORS allowed origin: ${CLIENT_ORIGIN}`);
});
