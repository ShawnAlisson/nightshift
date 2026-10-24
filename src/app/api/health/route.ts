import { connection, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  // Opt out of prerendering: a health check must reflect the database right now.
  await connection();
  try {
    const mongoose = await connectDB();
    return NextResponse.json({ status: "ok", db: mongoose.connection.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
