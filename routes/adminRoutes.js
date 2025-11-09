import express from "express";
import { auth, isAdmin } from "../middlewares/authMiddleware.js";
import {
  deleteUser,
  updateUserRole,
  getDashboard,
  getAllEvents,
  approveEvent,
  getAllUsers,
} from "../controllers/adminController.js";

const router = express.Router();

router.delete("/users/:id", auth, isAdmin, deleteUser);
router.put("/users/:id/role", auth, isAdmin, updateUserRole);
router.get("/dashboard", auth, isAdmin, getDashboard);
router.get("/events", auth, isAdmin, getAllEvents);
router.put("/events/approve/:id", auth, isAdmin, approveEvent);
router.get("/users", auth, isAdmin, getAllUsers);

export default router;
