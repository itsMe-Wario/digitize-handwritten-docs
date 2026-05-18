import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import ShopRecord from "@/lib/models/ShopRecord";

export async function GET() {
  try {
    await connectDB();

    // Total counts by status
    const statusCounts = await ShopRecord.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalUploads = await ShopRecord.countDocuments();

    // Quantity produced per machine
    const machineQuantities = await ShopRecord.aggregate([
      {
        $match: {
          machine_no: { $ne: null },
          qty_produced: { $ne: null, $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$machine_no",
          total_qty: { $sum: "$qty_produced" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total_qty: -1 } },
      {
        $project: {
          machine: "$_id",
          total_qty: 1,
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Shift-wise summary
    const shiftSummary = await ShopRecord.aggregate([
      {
        $match: { shift: { $ne: null } },
      },
      {
        $group: {
          _id: "$shift",
          count: { $sum: 1 },
          total_qty: { $sum: { $ifNull: ["$qty_produced", 0] } },
          avg_time: { $avg: "$time_taken_hrs" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          shift: { $concat: ["Shift ", { $toString: "$_id" }] },
          count: 1,
          total_qty: 1,
          avg_time: { $round: ["$avg_time", 2] },
          _id: 0,
        },
      },
    ]);

    // Validation failures
    const validationFailures = await ShopRecord.countDocuments({
      validation_errors: { $exists: true, $not: { $size: 0 } },
    });

    // Recent upload trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const uploadTrend = await ShopRecord.aggregate([
      {
        $match: { createdAt: { $gte: sevenDaysAgo } },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Status counts formatted for pie chart
    const statusData = ["Needs Review", "Approved"].map((status) => {
      const found = statusCounts.find((s) => s._id === status);
      return { name: status, value: found ? found.count : 0 };
    });

    return NextResponse.json(
      {
        totalUploads,
        validationFailures,
        statusData,
        machineQuantities,
        shiftSummary,
        uploadTrend,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics." },
      { status: 500 }
    );
  }
}
