import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import ShopRecord from "@/lib/models/ShopRecord";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { work_order_no: { $regex: search, $options: "i" } },
        { emp_no: { $regex: search, $options: "i" } },
        { machine_no: { $regex: search, $options: "i" } },
      ];
    }

    if (status && (status === "Needs Review" || status === "Approved")) {
      query.status = status;
    }

    // Populate upload_session_id but exclude the heavy base64 image for list view
    const documents = await ShopRecord.find(query)
      .populate("upload_session_id", "-original_image_base64")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(documents, { status: 200 });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Failed to fetch documents." }, { status: 500 });
  }
}
