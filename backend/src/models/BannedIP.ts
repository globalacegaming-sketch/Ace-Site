import mongoose, { Document, Schema } from 'mongoose';

export interface IBannedIP extends Document {
  _id: string;
  ip: string;
  bannedAt: Date;
  bannedBy?: string; // Admin/Agent who banned it
  reason?: string;
  userId?: string; // User whose IP was banned
  createdAt: Date;
  updatedAt: Date;
}

const BannedIPSchema = new Schema<IBannedIP>({
  ip: {
    type: String,
    required: [true, 'IP address is required'],
    unique: true,
    trim: true,
    index: true
  },
  bannedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  bannedBy: {
    type: String,
    trim: true
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Ban reason cannot exceed 500 characters']
  },
  userId: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for fast IP lookups
BannedIPSchema.index({ ip: 1 }, { unique: true });
BannedIPSchema.index({ bannedAt: -1 });

export default mongoose.model<IBannedIP>('BannedIP', BannedIPSchema);

