"use server";

import { isValidObjectId } from "mongoose";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/dal";
import { Conversation } from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";

export async function deleteConversation(formData: FormData) {
  const userId = await requireUserId();
  const id = formData.get("id");

  if (typeof id === "string" && isValidObjectId(id)) {
    await connectDB();
    await Conversation.deleteOne({ _id: id, userId });
  }
  redirect("/dashboard/assistant");
}
