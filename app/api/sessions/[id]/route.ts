import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import UploadSession from "@/lib/models/UploadSession";
import ShopRecord from "@/lib/models/ShopRecord";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    // Delete all rows belonging to this session first
    await ShopRecord.deleteMany({ upload_session_id: params.id });

    // Then delete the session itself
    const deleted = await UploadSession.findByIdAndDelete(params.id);

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