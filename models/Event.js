import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, default: "" },
    poster: { type: String, default: "" },
    date: { type: Date, required: true },
    category: { type: String, required: true, trim: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isApproved: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    cancelReason: { type: String, default: "" },
    isPaid: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
  },
  { timestamps: true }
);

EventSchema.index({ title: "text", description: "text", location: "text", category: "text" });

export default mongoose.model("Event", EventSchema);
