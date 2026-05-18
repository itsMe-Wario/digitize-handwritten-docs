import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUploadSession extends Document {
  original_image_base64: string;
  mime_type: string;
  row_count: number;
  createdAt: Date;
  updatedAt: Date;
}

const UploadSessionSchema = new Schema<IUploadSession>(
  {
    original_image_base64: { type: String, required: true },
    mime_type: { type: String, required: true, default: "image/jpeg" },
    row_count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const UploadSession: Model<IUploadSession> =
  mongoose.models.UploadSession ||
  mongoose.model<IUploadSession>("UploadSession", UploadSessionSchema);

export default UploadSession;