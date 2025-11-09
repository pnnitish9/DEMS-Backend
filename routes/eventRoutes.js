import express from "express";
import { auth, isOrganizer } from "../middlewares/authMiddleware.js";
import { eventValidator } from "../utils/validators.js";
import {
  createEvent,
  getEvents,
  getEventDetails,
  deleteEvent,
  cancelEvent,
  getOrganizerEvents,
  getEvent,
} from "../controllers/eventController.js";

const router = express.Router();

router.post("/", auth, isOrganizer, eventValidator, createEvent);
router.get("/", getEvents);
router.get("/details/:id", getEventDetails);
router.delete("/:id", auth, isOrganizer, deleteEvent);
router.put("/cancel/:id", auth, isOrganizer, cancelEvent);
router.get("/organizer", auth, isOrganizer, getOrganizerEvents);
router.get("/:id", getEvent);

export default router;
