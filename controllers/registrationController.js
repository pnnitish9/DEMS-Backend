import mongoose from "mongoose";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import { sendNotification } from "../utils/sendNotification.js";

export const registerEvent = async (req, res) => {
  const { eventId } = req.body;
  try {
    const event = await Event.findById(eventId).populate("organizer", "name");
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (!event.isApproved) return res.status(400).json({ message: "Event not approved" });
    if (event.isCancelled)
      return res.status(400).json({ message: "Event cancelled, registration closed" });

    const exists = await Registration.findOne({ user: req.user.id, event: eventId });
    if (exists) return res.status(400).json({ message: "Already registered" });

    const regId = new mongoose.Types.ObjectId();
    const qrData = JSON.stringify({
      regId,
      eventId: event._id,
      userId: req.user._id,
      name: req.user.name,
      email: req.user.email,
    });

    let registration = await new Registration({
      _id: regId,
      user: req.user.id,
      event: eventId,
      qrCode: qrData,
    }).save();

    registration = await Registration.findById(registration._id).populate("event");

    // Notify organizer about new registration
    await sendNotification(
      event.organizer,
      "New Registration",
      `${req.user.name} registered for "${event.title}".`,
      "event",
      String(event._id)
    );

    // Notify user about successful registration
    await sendNotification(
      req.user.id,
      "Registration Successful",
      `You have successfully registered for "${event.title}".`,
      "event",
      String(event._id)
    );

    res.status(201).json(registration);
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).send("Server error");
  }
};

export const myRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user.id })
      .populate({
        path: "event",
        model: "Event",
        populate: { path: "organizer", model: "User", select: "name email" },
      })
      .sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    console.error("My registrations error:", err);
    res.status(500).send("Server error");
  }
};

export const eventParticipants = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (String(event.organizer) !== String(req.user.id))
      return res.status(403).json({ message: "Not authorized" });

    const regs = await Registration.find({ event: req.params.eventId }).populate(
      "user",
      "name email"
    );
    res.json(regs);
  } catch (err) {
    console.error("Event participants error:", err);
    res.status(500).send("Server error");
  }
};

export const checkIn = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.regId).populate("event");
    if (!registration) return res.status(404).json({ message: "Registration not found" });
    if (String(registration.event.organizer) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized to check in for this event" });
    }

    const now = new Date();
    if (registration.lastScannedAt) {
      const diffMs = now - new Date(registration.lastScannedAt);
      const tenMin = 10 * 60 * 1000;
      if (diffMs < tenMin) {
        return res
          .status(429)
          .json({ message: "This QR was recently scanned. Try again later." });
      }
    }

    registration.checkIn = true;
    registration.lastScannedAt = now;
    await registration.save();

    // Populate user details for notification
    const regWithUser = await Registration.findById(registration._id).populate("user", "name");

    // Notify user about successful check-in
    await sendNotification(
      registration.user,
      "Check-In Successful",
      `You have joined "${registration.event.title}". Welcome!`,
      "event",
      String(registration.event._id)
    );

    // Notify organizer about the check-in
    await sendNotification(
      registration.event.organizer,
      "Participant Checked In",
      `${regWithUser.user.name} has checked in for "${registration.event.title}".`,
      "event",
      String(registration.event._id)
    );

    res.json(registration);
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).send("Server error");
  }
};
