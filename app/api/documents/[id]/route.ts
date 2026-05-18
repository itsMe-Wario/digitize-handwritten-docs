import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import ShopRecord from "@/lib/models/ShopRecord";
import { validateRecord } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    // Await the asynchronous params in Next.js 15
    const { id } = await params;

    // Populate the full session including the image for the edit screen
    const record = await ShopRecord.findById(id)
      .populate("upload_session_id")
      .lean();

    if (!record) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    return NextResponse.json(record, { status: 200 });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json({ error: "Failed to fetch document." }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    // Await the asynchronous params in Next.js 15
    const { id } = await params;
    const body = await request.json();

    const {
      date, shift, emp_no, opn_code,
      machine_no, work_order_no, qty_produced, time_taken_hrs,
    } = body;

    const parsedShift = shift !== undefined && shift !== "" ? Number(shift) : null;
    const parsedQty = qty_produced !== undefined && qty_produced !== "" ? Number(qty_produced) : null;
    const parsedTime = time_taken_hrs !== undefined && time_taken_hrs !== "" ? Number(time_taken_hrs) : null;

    const validationErrors = validateRecord({
      date, shift: parsedShift, emp_no, opn_code,
      machine_no, work_order_no,
      qty_produced: parsedQty,
      time_taken_hrs: parsedTime,
      confidence_scores: {
        date: 100, shift: 100, emp_no: 100, opn_code: 100,
        machine_no: 100, work_order_no: 100, qty_produced: 100, time_taken_hrs: 100,
      },
    });

    const updated = await ShopRecord.findByIdAndUpdate(
      id,
      {
        $set: {
          date, shift: parsedShift, emp_no, opn_code,
          machine_no, work_order_no,
          qty_produced: parsedQty,
          time_taken_hrs: parsedTime,
          status: "Approved",
          validation_errors: validationErrors,
        },
      },
      { new: true }
    ).populate("upload_session_id", "-original_image_base64");

    if (!updated) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json({ error: "Failed to update document." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    // Await the asynchronous params in Next.js 15
    const { id } = await params;
    const deleted = await ShopRecord.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Record deleted successfully." }, { status: 200 });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}
