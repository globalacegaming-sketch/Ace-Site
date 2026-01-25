import mongoose, { Document, Schema, Types } from 'mongoose';

export type SliceType = 'lose' | 'cash' | 'discount' | 'free_spin' | 'custom';

export interface IWheelSlice extends Document {
  campaignId: Types.ObjectId;
  label: string; // e.g., "$5", "Try Again", "10% Off"
  type: SliceType;
  prizeValue?: string; // Depends on type
  costToBusiness: number; // Mandatory - even non-cash prizes need estimated cost
  enabled: boolean;
  maxWins?: number; // Optional inventory control (null = unlimited)
  currentWins: number; // Track how many times this slice has been won
  order: number; // For sorting
  color?: string; // Custom color for the slice (hex format)
  createdAt: Date;
  updatedAt: Date;
}

const WheelSliceSchema = new Schema<IWheelSlice>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'WheelCampaign',
      required: true,
      index: true
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, 'Slice label cannot exceed 50 characters']
    },
    type: {
      type: String,
      enum: ['lose', 'cash', 'discount', 'free_spin', 'custom'],
      required: true
    },
    prizeValue: {
      type: String,
      trim: true
    },
    costToBusiness: {
      type: Number,
      required: true,
      min: [0, 'Cost cannot be negative']
    },
    enabled: {
      type: Boolean,
      default: true
    },
    maxWins: {
      type: Number,
      min: [0, 'Max wins cannot be negative']
    },
    currentWins: {
      type: Number,
      default: 0,
      min: [0, 'Current wins cannot be negative']
    },
    order: {
      type: Number,
      default: 0
    },
    color: {
      type: String,
      trim: true,
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color code']
    }
  },
  {
    timestamps: true
  }
);

WheelSliceSchema.index({ campaignId: 1, enabled: 1, order: 1 });
WheelSliceSchema.index({ campaignId: 1, createdAt: -1 });

export default mongoose.model<IWheelSlice>('WheelSlice', WheelSliceSchema);

