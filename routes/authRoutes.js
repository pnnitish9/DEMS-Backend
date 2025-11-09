import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import { registerValidator, loginValidator } from "../utils/validators.js";
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerValidator, register);
router.post("/login", loginValidator, login);
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.put("/password", auth, changePassword);
router.delete("/account", auth, deleteAccount);

export default router;
