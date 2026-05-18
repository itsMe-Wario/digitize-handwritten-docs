import mongoose, { Schema, Document, Model } from "mongoose";

export interface IConfidenceScores {
  date: number;
  shift: number;
  emp_no: number;
  opn_code: number;
  machine_no: number;
  work_order_no: number;
  qty_produced: number;
  time_taken_hrs: number;
}

export interface IShopRecord extends Document {
  upload_session_id: mongoose.Types.ObjectId;
  status: "Needs Review" | "Approved";
  date: string | null;
  shift: number | null;
  emp_no: string | null;
  opn_code: string | null;
  machine_no: string | null;
  work_order_no: string | null;
  qty_produced: number | null;
  time_taken_hrs: number | null;
  confidence_scores: IConfidenceScores;
  validation_errors: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ConfidenceScoresSchema = new Schema<IConfidenceScores>(
  {
    date: { type: Number, default: 0 },
    shift: { type: Number, default: 0 },
    emp_no: { type: Number, default: 0 },
    opn_code: { type: Number, default: 0 },
    machine_no: { type: Number, default: 0 },
    work_order_no: { type: Number, default: 0 },
    qty_produced: { type: Number, default: 0 },
    time_taken_hrs: { type: Number, default: 0 },
  },
  { _id: false }
);

const ShopRecordSchema = new Schema<IShopRecord>(
  {
    upload_session_id: {
      type: Schema.Types.ObjectId,
      ref: "UploadSession",
      required: true,
    },
    status: {
      type: String,
      enum: ["Needs Review", "Approved"],
      default: "Needs Review",
    },
    date: { type: String, default: null },
    shift: { type: Number, default: null },
    emp_no: { type: String, default: null },
    opn_code: { type: String, default: null },
    machine_no: { type: String, default: null },
    work_order_no: { type: String, default: null },
    qty_produced: { type: Number, default: null },
    time_taken_hrs: { type: Number, default: null },
    confidence_scores: {
      type: ConfidenceScoresSchema,
      default: () => ({
        date: 0, shift: 0, emp_no: 0, opn_code: 0,
        machine_no: 0, work_order_no: 0, qty_produced: 0, time_taken_hrs: 0,
      }),
    },
    validation_errors: { type: [String], default: [] },
  },
  { timestamps: true }
);

const ShopRecord: Model<IShopRecord> =
  mongoose.models.ShopRecord ||
  mongoose.model<IShopRecord>("ShopRecord", ShopRecordSchema);

export default ShopRecord;