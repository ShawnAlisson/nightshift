import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned by default; select it explicitly when verifying a login.
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export type IUser = InferSchemaType<typeof userSchema>;

export const User: Model<IUser> = models.User || model<IUser>("User", userSchema);
