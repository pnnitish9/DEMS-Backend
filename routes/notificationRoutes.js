import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import {
  getMyNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  deleteOne,
  clearAll,
  deleteMultiple,
} from "../controllers/notificationController.js";

const router = express.Router();

// Get notifications with pagination and filters
router.get("/my", auth, getMyNotifications);

// Get unread count
router.get("/unread-count", auth, getUnreadCount);

// Mark single notification as read
router.put("/:id/read", auth, markOneRead);

// Mark all notifications as read
router.put("/read-all", auth, markAllRead);

// Delete single notification
router.delete("/:id", auth, deleteOne);

// Delete multiple notifications
router.post("/delete-multiple", auth, deleteMultiple);

// Clear all notifications (or only read ones with ?readOnly=true)
router.delete("/", auth, clearAll);

export default router;
