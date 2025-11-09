import express from "express";
import { auth, isOrganizer } from "../middlewares/authMiddleware.js";
import {
  registerEvent,
  myRegistrations,
  eventParticipants,
  checkIn,
} from "../controllers/registrationController.js";

const router = express.Router();

router.post("/", auth, registerEvent);
router.get("/my", auth, myRegistrations);
router.get("/event/:eventId", auth, isOrganizer, eventParticipants);
router.put("/checkin/:regId", auth, isOrganizer, checkIn);

export default router;
