import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { body, validationResult } from "express-validator";

/* ------------------------- CONFIGURATION ------------------------- */
const app = express();
const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());


/* ----------------------- DATABASE CONNECTION --------------------- */
mongoose
  .connect(MONGO_URI, {
    // modern mongoose doesn’t need extra flags, but harmless to keep:
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

/* --------------------------- MODELS ------------------------------ */
// USER MODEL
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["participant", "organizer", "admin"],
      default: "participant",
    },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", UserSchema);

// EVENT MODEL
const EventSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    location: String,
    poster: String,
    date: Date,
    category: String,
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    isApproved: { type: Boolean, default: false },

    // ✅ new fields
    isCancelled: { type: Boolean, default: false },
    cancelReason: { type: String, default: "" },

    isPaid: Boolean,
    price: Number,

  },
  { timestamps: true }
);


const Event = mongoose.model("Event", EventSchema);

// REGISTRATION MODEL
const RegistrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Event",
    },
    checkIn: { type: Boolean, default: false },
    qrCode: { type: String, required: true }, // store JSON string
  },
  { timestamps: true }
);

RegistrationSchema.index({ user: 1, event: 1 }, { unique: true });

const Registration = mongoose.model("Registration", RegistrationSchema);

/* --------------------------- UTILS ------------------------------- */
const generateToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: "30d" });

/* ------------------------- MIDDLEWARE ---------------------------- */
const auth = async (req, res, next) => {
  let token;
  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return res
          .status(401)
          .json({ message: "Not authorized, user not found" });
      }
      req.user = user;
      return next();
    }
    return res.status(401).json({ message: "Not authorized, no token" });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Not authorized as an admin" });
};

const isOrganizer = (req, res, next) => {
  if (req.user && (req.user.role === "organizer" || req.user.role === "admin"))
    return next();
  return res
    .status(403)
    .json({ message: "Not authorized as an organizer or admin" });
};

/* ------------------------- VALIDATORS ---------------------------- */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
  next();
};

const registerValidator = [
  body("name", "Name is required").trim().notEmpty(),
  body("email", "Valid email is required").isEmail().normalizeEmail(),
  body("password", "Password is required").isLength({ min: 1 }),
  body("role", "Role must be participant or organizer").isIn([
    "participant",
    "organizer",
  ]),
  handleValidationErrors,
];

const loginValidator = [
  body("email", "Valid email is required").isEmail().normalizeEmail(),
  body("password", "Password is required").exists(),
  handleValidationErrors,
];

// ✅ FIX #5: Boolean + conditional numeric validation for price
const eventValidator = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("date").isISO8601().withMessage("Date must be ISO8601"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("isPaid").optional().isBoolean().toBoolean(),
  body("price")
    .optional()
    .custom((value, { req }) => {
      // only validate price if isPaid === true
      if (req.body.isPaid === true) {
        if (value === undefined || value === null || value === "")
          throw new Error("Price is required when event is paid");
        if (isNaN(value)) throw new Error("Price must be a number");
        if (Number(value) < 0) throw new Error("Price cannot be negative");
      }
      return true;
    }),
  handleValidationErrors,
];

/* --------------------------- ROUTES ------------------------------ */
/* Auth & User */
const authRouter = express.Router();

// Register
authRouter.post("/register", registerValidator, async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    user = new User({ name, email, password, role });
    await user.save();
    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Login
authRouter.post("/login", loginValidator, async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Profile (get)
authRouter.get("/profile", auth, (req, res) => {
  return res.json(req.user);
});

// Profile (update name)
authRouter.put("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.name = (req.body.name || "").trim() || user.name;
    const updated = await user.save();
    return res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Change password
authRouter.put("/password", auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect current password" });
    user.password = newPassword; // pre-save hook will hash
    await user.save();
    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Delete account (and clean related data)
// ✅ FIX #4: remove user registrations, organizer events, and related registrations for those events
authRouter.delete("/account", auth, async (req, res) => {
  const { password } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res
        .status(400)
        .json({ message: "Incorrect password. Account not deleted." });

    // delete user's own registrations
    await Registration.deleteMany({ user: req.user.id });

    if (user.role === "organizer") {
      // find organizer events
      const organizerEvents = await Event.find({ organizer: req.user.id }).select(
        "_id"
      );
      const eventIds = organizerEvents.map((e) => e._id);

      // delete registrations for those events
      if (eventIds.length > 0) {
        await Registration.deleteMany({ event: { $in: eventIds } });
      }
      // delete events themselves
      await Event.deleteMany({ _id: { $in: eventIds } });
    }

    await user.deleteOne();
    return res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

app.use("/api/auth", authRouter);

/* Events */
const eventRouter = express.Router();

// Create event (organizer/admin)
// ✅ FIX #2 confirmed: admin auto-approves
eventRouter.post("/", auth, isOrganizer, eventValidator, async (req, res) => {
  try {
    const payload = {
      title: req.body.title,
      description: req.body.description,
      date: req.body.date,
      category: req.body.category,
      isPaid: !!req.body.isPaid,
      price:
        req.body.isPaid === true ? Number(req.body.price || 0) : 0,
      organizer: req.user.id,
      isApproved: req.user.role === "admin",
    };

    const event = await new Event(payload).save();
    return res.status(201).json(event);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// List approved events (public)
eventRouter.get("/", async (req, res) => {
  try {
    const events = await Event.find({ isApproved: true }).sort({ date: 1 });
    return res.json(events);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

eventRouter.get("/details/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("organizer", "name email role");

    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.json(event);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

eventRouter.delete("/:id", auth, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.organizer.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not allowed" });

    // Delete all registrations for this event
    await Registration.deleteMany({ event: req.params.id });

    // Delete event
    await event.deleteOne();

    return res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});


eventRouter.put("/cancel/:id", auth, isOrganizer, async (req, res) => {
  try {
    const { reason } = req.body;

    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.organizer.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not allowed" });

    event.isCancelled = true;
    event.cancelReason = reason || "Event was cancelled.";
    await event.save();

    return res.json({ message: "Event cancelled", event });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});




// Organizer's events
eventRouter.get("/organizer", auth, isOrganizer, async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id }).sort({
      date: -1,
    });
    return res.json(events);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Single event (public)
eventRouter.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    return res.json(event);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

app.use("/api/events", eventRouter);

/* Registrations */
const registrationRouter = express.Router();

// Register for event (private)
registrationRouter.post("/", auth, async (req, res) => {
  const { eventId } = req.body;

  try {
    const event = await Event.findById(eventId);
    if (!event)
      return res.status(404).json({ message: "Event not found" });

    if (!event.isApproved)
      return res.status(400).json({ message: "Event not approved" });

    // Prevent duplicate registrations
    const exists = await Registration.findOne({
      user: req.user.id,
      event: eventId,
    });

    if (exists)
      return res.status(400).json({ message: "Already registered" });

    // Generate ID + QR Data
    const regId = new mongoose.Types.ObjectId();

    const qrData = JSON.stringify({
      regId,
      eventId: event._id,
      userId: req.user._id,
      name: req.user.name,
      email: req.user.email,
    });

    // Create registration
    let registration = await new Registration({
      _id: regId,
      user: req.user.id,
      event: eventId,
      qrCode: qrData,
    }).save();

    // ✅ Populate full event info before sending to frontend
    registration = await Registration.findById(registration._id)
      .populate("event");

    return res.status(201).json(registration);
  } catch (err) {
    console.error("Registration Error:", err);
    return res.status(500).send("Server error");
  }
});


// My registrations
registrationRouter.get("/my", auth, async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user.id })
      .populate({
        path: "event",
        model: "Event",
        populate: {
          path: "organizer",
          model: "User",
          select: "name email"
        }
      })
      .sort({ createdAt: -1 });

    return res.json(registrations);
  } catch (err) {
    console.error("My Reg Error:", err);
    return res.status(500).send("Server error");
  }
});



// Participants for a given event (organizer/admin)
registrationRouter.get(
  "/event/:eventId",
  auth,
  isOrganizer,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.eventId);
      if (!event || event.organizer.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Not authorized to view these participants" });
      }

      const regs = await Registration.find({ event: req.params.eventId }).populate(
        "user",
        "name email"
      );
      return res.json(regs);
    } catch (err) {
      console.error(err.message);
      return res.status(500).send("Server error");
    }
  }
);

// Check-in a participant (organizer/admin)
registrationRouter.put(
  "/checkin/:regId",
  auth,
  isOrganizer,
  async (req, res) => {
    try {
      const registration = await Registration.findById(req.params.regId).populate(
        "event"
      );
      if (!registration)
        return res.status(404).json({ message: "Registration not found" });

      if (registration.event.organizer.toString() !== req.user.id) {
        return res.status(403).json({
          message: "Not authorized to check in participants for this event",
        });
      }

      registration.checkIn = true;
      await registration.save();
      return res.json(registration);
    } catch (err) {
      console.error(err.message);
      return res.status(500).send("Server error");
    }
  }
);

app.use("/api/registrations", registrationRouter);

/* Admin */
const adminRouter = express.Router();

/* -------------------------------------
   ✅ ADMIN — DELETE ANY USER 
-------------------------------------- */
adminRouter.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot delete admin users" });
    }

    // delete their registrations
    await Registration.deleteMany({ user: user._id });

    // if organizer → delete events + event registrations
    if (user.role === "organizer") {
      const events = await Event.find({ organizer: user._id }).select("_id");
      const eventIds = events.map((e) => e._id);

      await Registration.deleteMany({ event: { $in: eventIds } });
      await Event.deleteMany({ _id: { $in: eventIds } });
    }

    await user.deleteOne();

    return res.json({ message: "User deleted successfully" });

  } catch (err) {
    console.error("Admin delete error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


/* -------------------------------------
   ✅ ADMIN — UPDATE ANY USER ROLE
-------------------------------------- */
adminRouter.put("/users/:id/role", async (req, res) => {
  const { role } = req.body;

  if (!["participant", "organizer"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const user = await User.findById(req.params.id);

    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (user.role === "admin") {
      return res
        .status(403)
        .json({ message: "Cannot change role of admin user" });
    }

    user.role = role;
    await user.save();

    return res.json({
      message: "Role updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    console.error("Admin role change error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// Dashboard stats
adminRouter.get("/dashboard", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const eventCount = await Event.countDocuments();
    const regCount = await Registration.countDocuments();

    const trend = await Registration.aggregate([
      { $group: { _id: { $month: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const categories = await Event.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    return res.json({ userCount, eventCount, regCount, trend, categories });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// All events
adminRouter.get("/events", async (req, res) => {
  try {
    const events = await Event.find()
      .populate("organizer", "name email")
      .sort({ createdAt: -1 });
    return res.json(events);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Approve/unlist event
adminRouter.put("/events/approve/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    event.isApproved = Boolean(req.body.isApproved);
    await event.save();
    return res.json(event);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// All users
adminRouter.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.json(users);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// ✅ FIX #1 (confirmed): apply admin protection globally on mount
app.use("/api/admin", auth, isAdmin, adminRouter);

/* --------------------------- START ------------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
