import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReferral extends Document {
  referredUser: Types.ObjectId;       // The new user who signed up with a code
  referredBy: Types.ObjectId;         // The user who owns the referral code
  referralCode: string;               // The code that was used
  status: 'pending' | 'verified';
  bonusGranted: boolean;
  bonusAmount: number;
  verifiedAt?: Date;
  verifiedBy?: string;                // Agent username who verified
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referredUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified'],
      default: 'pending',
      index: true,
    },
    bonusGranted: {
      type: Boolean,
      default: false,
    },
    bonusAmount: {
      type: Number,
      default: 10,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
ReferralSchema.index({ referredUser: 1, referredBy: 1 }, { unique: true });
ReferralSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IReferral>('Referral', ReferralSchema);
