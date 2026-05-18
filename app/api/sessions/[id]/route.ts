import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import UploadSession from "@/lib/models/UploadSession";
import ShopRecord from "@/lib/models/ShopRecord";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Await the asynchronous params in Next.js 15
    const { id } = await params;

    // Delete all rows belonging to this session first
    await ShopRecord.deleteMany({ upload_session_id: id });

    // Then delete the session itself
    const deleted = await UploadSession.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Session and all its rows deleted." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json({ error: "Failed to delete session." }, { status: 500 });
  }
}