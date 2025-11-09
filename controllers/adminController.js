import User from "../models/User.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import Notification from "../models/Notification.js";
import { sendNotification, sendNotificationsToMany } from "../utils/sendNotification.js";

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(403).json({ message: "Cannot delete admin users" });

    await sendNotification(user._id, "Account Deleted", "Your account was removed by the admin.", "user", String(user._id));
    await Registration.deleteMany({ user: user._id });

    if (user.role === "organizer") {
      const events = await Event.find({ organizer: user._id });
      const eventIds = events.map((e) => e._id);
      for (const e of events) {
        const regs = await Registration.find({ event: e._id }).populate("user", "_id");
        for (const r of regs) {
          await sendNotification(
            r.user._id,
            "Event Deleted",
            `"${e.title}" was deleted because the organizer account was removed.`,
            "event",
            String(e._id)
          );
        }
      }
      if (eventIds.length) {
        await Registration.deleteMany({ event: { $in: eventIds } });
        await Event.deleteMany({ _id: { $in: eventIds } });
      }
    }

    await Notification.deleteMany({ user: user._id });
    await user.deleteOne();
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Admin delete user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!["participant", "organizer"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(403).json({ message: "Cannot change admin role" });

    user.role = role;
    await user.save();
    await sendNotification(user._id, "Role Updated", `Your role is now "${role}".`, "user", String(user._id));
    res.json({
      message: "Role updated successfully",
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Admin role change error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDashboard = async (req, res) => {
  try {
    const [userCount, eventCount, regCount] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Registration.countDocuments(),
    ]);
    const trend = await Registration.aggregate([
      { $group: { _id: { $month: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const categories = await Event.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ userCount, eventCount, regCount, trend, categories });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find().populate("organizer", "name email").sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error("Admin list events error:", err.message);
    res.status(500).send("Server error");
  }
};

export const approveEvent = async (req, res) => {
  try {
    const { isApproved } = req.body;
    const event = await Event.findById(req.params.id).populate("organizer", "name");
    if (!event) return res.status(404).json({ message: "Event not found" });

    event.isApproved = Boolean(isApproved);
    await event.save();

    await sendNotification(
      event.organizer._id,
      event.isApproved ? "Event Approved" : "Event Unlisted",
      `Your event "${event.title}" is now ${event.isApproved ? "approved" : "unlisted"}.`,
      "event",
      String(event._id)
    );

    if (event.isApproved) {
      const participants = await User.find({ role: "participant" }).select("_id");
      const participantIds = participants.map((p) => p._id);
      await sendNotificationsToMany(
        participantIds,
        "New Event Published",
        `A new event "${event.title}" is now available.`,
        "event",
        String(event._id)
      );
    }

    res.json(event);
  } catch (err) {
    console.error("Admin approve/unlist error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("Admin users error:", err.message);
    res.status(500).send("Server error");
  }
};
