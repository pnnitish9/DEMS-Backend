import jwt from "jsonwebtoken";
import User from "../models/User.js";

// JWT Token Generator
export const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// Auth Middleware
export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "Not authorized, user not found" });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// Role Middlewares
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Not authorized as an admin" });
};

export const isOrganizer = (req, res, next) => {
  if (req.user && (req.user.role === "organizer" || req.user.role === "admin")) return next();
  return res.status(403).json({ message: "Not authorized as an organizer/admin" });
};
