import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export type IUser = InferSchemaType<typeof userSchema>;

export const User: Model<IUser> = models.User || model<IUser>("User", userSchema);
