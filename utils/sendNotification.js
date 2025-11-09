import Notification from "../models/Notification.js";
import { userRoom } from "../config/socket.js";

let ioInstance = null;

export const setSocketIO = (io) => {
  ioInstance = io;
};

export const sendNotification = async (userId, title, message, linkType = "", linkId = "") => {
  try {
    const doc = await Notification.create({ user: userId, title, message, linkType, linkId });
    
    if (ioInstance) {
      ioInstance.to(userRoom(userId)).emit("notification:new", {
        _id: doc._id,
        user: doc.user,
        title: doc.title,
        message: doc.message,
        read: doc.read,
        linkType: doc.linkType,
        linkId: doc.linkId,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    }
    
    return doc;
  } catch (err) {
    console.log("Notification Error:", err?.message || err);
    return null;
  }
};

export const sendNotificationsToMany = async (userIds, title, message, linkType = "", linkId = "") => {
  try {
    const payloads = userIds.map((uid) => ({
      user: uid,
      title,
      message,
      read: false,
      linkType,
      linkId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    if (payloads.length === 0) return [];
    
    const docs = await Notification.insertMany(payloads, { ordered: false });
    
    if (ioInstance) {
      userIds.forEach((uid) => {
        const doc = docs.find((d) => String(d.user) === String(uid));
        if (doc) {
          ioInstance.to(userRoom(uid)).emit("notification:new", {
            _id: doc._id,
            user: doc.user,
            title: doc.title,
            message: doc.message,
            read: doc.read,
            linkType: doc.linkType,
            linkId: doc.linkId,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          });
        }
      });
    }
    
    return docs;
  } catch (err) {
    console.log("Notification broadcast error:", err?.message || err);
    return [];
  }
};
