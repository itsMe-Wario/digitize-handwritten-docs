import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import UploadSession from "@/lib/models/UploadSession";
import ShopRecord from "@/lib/models/ShopRecord";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowQuery: Record<string, any> = {};

    if (search) {
      rowQuery.$or = [
        { work_order_no: { $regex: search, $options: "i" } },
        { emp_no: { $regex: search, $options: "i" } },
        { machine_no: { $regex: search, $options: "i" } },
      ];
    }

    if (status && (status === "Needs Review" || status === "Approved")) {
      rowQuery.status = status;
    }

    // All sessions, no image, newest first
    const sessions = await UploadSession.find({})
      .select("-original_image_base64")
      .sort({ createdAt: -1 })
      .lean();

    const result = await Promise.all(
      sessions.map(async (session) => {
        const rows = await ShopRecord.find({
          upload_session_id: session._id,
          ...rowQuery,
        })
          .select(
            "_id status date shift emp_no opn_code machine_no work_order_no qty_produced time_taken_hrs validation_errors confidence_scores"
          )
          .sort({ createdAt: 1 })
          .lean();

        return { ...session, rows };
      })
    );

    // When filtering, hide sessions with no matching rows
    const filtered =
      search || status
        ? result.filter((s) => s.rows.length > 0)
        : result;

    return NextResponse.json(filtered, { status: 200 });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({ error: "Failed to fetch sessions." }, { status: 500 });
  }
}