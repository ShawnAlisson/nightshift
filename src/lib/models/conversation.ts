import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

// Serves the sidebar query: a user's conversations, newest first.
conversationSchema.index({ userId: 1, updatedAt: -1 });

export type IConversation = InferSchemaType<typeof conversationSchema>;

export const Conversation: Model<IConversation> =
  models.Conversation || model<IConversation>("Conversation", conversationSchema);
