import { body, validationResult } from "express-validator";

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

export const registerValidator = [
  body("name", "Name is required").trim().notEmpty(),
  body("email", "Valid email is required").isEmail().normalizeEmail(),
  body("password", "Password is required").isLength({ min: 1 }),
  body("role")
    .optional()
    .isIn(["participant", "organizer", "admin"])
    .withMessage("Role must be participant/organizer/admin"),
  handleValidationErrors,
];

export const loginValidator = [
  body("email", "Valid email is required").isEmail().normalizeEmail(),
  body("password", "Password is required").exists(),
  handleValidationErrors,
];

export const eventValidator = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("date").isISO8601().withMessage("Date must be ISO8601"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("isPaid").optional().isBoolean().toBoolean(),
  body("price")
    .optional()
    .custom((value, { req }) => {
      const isPaid =
        req.body.isPaid === true ||
        req.body.isPaid === "true" ||
        req.body.isPaid === 1 ||
        req.body.isPaid === "1";
      if (isPaid) {
        if (value === undefined || value === null || value === "")
          throw new Error("Price is required when event is paid");
        if (isNaN(value)) throw new Error("Price must be a number");
        if (Number(value) < 0) throw new Error("Price cannot be negative");
      }
      return true;
    }),
  handleValidationErrors,
];
