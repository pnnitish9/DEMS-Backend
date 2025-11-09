import Notification from "../models/Notification.js";

export const getMyNotifications = async (req, res) => {
  try {
    // Check if legacy mode (no pagination params = return array for backward compatibility)
    const usePagination = req.query.page !== undefined || req.query.limit !== undefined;
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || (usePagination ? 20 : 100);
    const skip = (page - 1) * limit;

    // Filter parameters
    const filter = { user: req.user.id };
    
    // Filter by read status if provided
    if (req.query.read !== undefined) {
      filter.read = req.query.read === "true";
    }

    // Filter by linkType if provided (e.g., only "event" notifications)
    if (req.query.linkType) {
      filter.linkType = req.query.linkType;
    }

    // Get notifications with pagination
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance
      Notification.countDocuments(filter),
    ]);

    // Backward compatibility: return array if no pagination params
    if (!usePagination) {
      return res.json(notifications);
    }

    // New format: return object with pagination
    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total,
      },
    });
  } catch (err) {
    console.error("Get notifications error:", err.message);
    res.status(500).send("Server error");
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ count });
  } catch (err) {
    console.error("Unread count error:", err.message);
    res.status(500).send("Server error");
  }
};

export const markOneRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ success: true, notification });
  } catch (err) {
    console.error("Mark one read error:", err.message);
    res.status(500).send("Server error");
  }
};

export const markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("Mark all read error:", err.message);
    res.status(500).send("Server error");
  }
};

export const deleteOne = async (req, res) => {
  try {
    const result = await Notification.deleteOne({ _id: req.params.id, user: req.user.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Delete notification error:", err.message);
    res.status(500).send("Server error");
  }
};

export const clearAll = async (req, res) => {
  try {
    // Optional: only clear read notifications
    const filter = { user: req.user.id };
    if (req.query.readOnly === "true") {
      filter.read = true;
    }
    
    const result = await Notification.deleteMany(filter);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Clear notifications error:", err.message);
    res.status(500).send("Server error");
  }
};

export const deleteMultiple = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid notification IDs" });
    }

    const result = await Notification.deleteMany({
      _id: { $in: ids },
      user: req.user.id,
    });

    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Delete multiple notifications error:", err.message);
    res.status(500).send("Server error");
  }
};
