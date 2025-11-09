import User from "../models/User.js";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import Notification from "../models/Notification.js";
import { generateToken } from "../middlewares/authMiddleware.js";
import { sendNotification } from "../utils/sendNotification.js";

export const register = async (req, res) => {
  const { name, email, password, role = "participant" } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });
    user = new User({ name, email, password, role });
    await user.save();
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).send("Server error");
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getProfile = (req, res) => {
  res.json(req.user);
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.name = (req.body.name || "").trim() || user.name;
    const updated = await user.save();
    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    });
  } catch (err) {
    console.error("Profile update error:", err.message);
    res.status(500).send("Server error");
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password change error:", err.message);
    res.status(500).send("Server error");
  }
};

export const deleteAccount = async (req, res) => {
  const { password } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

    await Registration.deleteMany({ user: req.user.id });

    if (user.role === "organizer") {
      const organizerEvents = await Event.find({ organizer: req.user.id }).select("_id title");
      const eventIds = organizerEvents.map((e) => e._id);
      if (eventIds.length > 0) {
        for (const e of organizerEvents) {
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
        await Registration.deleteMany({ event: { $in: eventIds } });
        await Event.deleteMany({ _id: { $in: eventIds } });
      }
    }

    await Notification.deleteMany({ user: req.user.id });
    await user.deleteOne();
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Account delete error:", err.message);
    res.status(500).send("Server error");
  }
};
