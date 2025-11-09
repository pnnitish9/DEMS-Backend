import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import User from "../models/User.js";
import { sendNotification, sendNotificationsToMany } from "../utils/sendNotification.js";

export const createEvent = async (req, res) => {
  try {
    const payload = {
      title: req.body.title,
      description: req.body.description,
      date: req.body.date,
      category: req.body.category,
      location: req.body.location || "",
      poster: req.body.poster || "",
      isPaid: !!req.body.isPaid,
      price: req.body.isPaid ? Number(req.body.price || 0) : 0,
      organizer: req.user.id,
      isApproved: req.user.role === "admin",
    };
    const event = await new Event(payload).save();

    if (req.user.role === "organizer") {
      const admins = await User.find({ role: "admin" }).select("_id");
      const adminIds = admins.map((a) => a._id);
      await sendNotificationsToMany(
        adminIds,
        "New Event Submitted",
        `Organizer "${req.user.name}" created "${event.title}". Approve it from admin panel.`,
        "event",
        String(event._id)
      );
    }

    res.status(201).json(event);
  } catch (err) {
    console.error("Create event error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getEvents = async (req, res) => {
  try {
    const events = await Event.find({ isApproved: true }).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error("List events error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getEventDetails = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("organizer", "name email role");
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    console.error("Event details error:", err.message);
    res.status(500).send("Server error");
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (String(event.organizer) !== String(req.user._id))
      return res.status(403).json({ message: "Not allowed" });

    const regs = await Registration.find({ event: event._id }).populate("user", "_id name");
    for (const r of regs) {
      await sendNotification(
        r.user._id,
        "Event Deleted",
        `"${event.title}" has been deleted by the organizer.`,
        "event",
        String(event._id)
      );
    }
    await sendNotification(
      event.organizer,
      "Event Deleted",
      `Your event "${event.title}" was deleted.`,
      "event",
      String(event._id)
    );

    await Registration.deleteMany({ event: req.params.id });
    await event.deleteOne();
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("Delete event error:", err.message);
    res.status(500).send("Server error");
  }
};

export const cancelEvent = async (req, res) => {
  try {
    const { reason } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (String(event.organizer) !== String(req.user._id))
      return res.status(403).json({ message: "Not allowed" });

    event.isCancelled = true;
    event.cancelReason = (reason || "Event was cancelled.").trim();
    await event.save();

    const regs = await Registration.find({ event: event._id }).populate("user", "_id name");
    for (const r of regs) {
      await sendNotification(
        r.user._id,
        "Event Cancelled",
        `"${event.title}" has been cancelled by the organizer.`,
        "event",
        String(event._id)
      );
    }
    await sendNotification(
      event.organizer,
      "Your Event Cancelled",
      `"${event.title}" is now marked as cancelled.`,
      "event",
      String(event._id)
    );

    res.json({ message: "Event cancelled", event });
  } catch (err) {
    console.error("Cancel event error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getOrganizerEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id }).sort({ date: -1 });
    res.json(events);
  } catch (err) {
    console.error("Organizer events error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    console.error("Get event error:", err.message);
    res.status(500).send("Server error");
  }
};
