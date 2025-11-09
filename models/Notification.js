import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    linkType: { type: String, default: "" },
    linkId: { type: String, default: "" },
  },
  { timestamps: true }
);

// Indexes for better query performance
NotificationSchema.index({ user: 1, createdAt: -1 }); // For pagination
NotificationSchema.index({ user: 1, read: 1 }); // For filtering by read status
NotificationSchema.index({ user: 1, linkType: 1 }); // For filtering by type

export default mongoose.model("Notification", NotificationSchema);
