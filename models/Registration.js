import mongoose from "mongoose";

const RegistrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    event: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Event" },
    checkIn: { type: Boolean, default: false },
    qrCode: { type: String, required: true },
    lastScannedAt: { type: Date },
  },
  { timestamps: true }
);

RegistrationSchema.index({ user: 1, event: 1 }, { unique: true });

export default mongoose.model("Registration", RegistrationSchema);
