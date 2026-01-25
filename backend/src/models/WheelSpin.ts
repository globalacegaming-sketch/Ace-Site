import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWheelSpin extends Document {
  campaignId: Types.ObjectId;
  sliceId: Types.ObjectId; // Reference to the wheel slice won
  userId: Types.ObjectId;
  rewardType: 'better_luck' | 'try_again' | 'bonus_1' | 'bonus_5' | 'bonus_10' | 'bonus_50_percent';
  rewardValue?: string; // e.g., "$1", "$5", "$10", "50%"
  cost: number; // Cost to business for this spin
  bonusSent: boolean; // Whether bonus message was sent to chat
  messageId?: Types.ObjectId; // Reference to ChatMessage if bonus was sent
  redeemed: boolean; // Whether prize has been redeemed
  redeemedAt?: Date; // When prize was redeemed
  redeemedBy?: Types.ObjectId; // Admin/agent who marked as redeemed
  createdAt: Date;
  updatedAt: Date;
}

const WheelSpinSchema = new Schema<IWheelSpin>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'WheelCampaign',
      required: true,
      index: true
    },
    sliceId: {
      type: Schema.Types.ObjectId,
      ref: 'WheelSlice',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    rewardType: {
      type: String,
      enum: ['better_luck', 'try_again', 'bonus_1', 'bonus_5', 'bonus_10', 'bonus_50_percent'],
      required: true
    },
    rewardValue: {
      type: String,
      trim: true
    },
    cost: {
      type: Number,
      required: true,
      min: [0, 'Cost cannot be negative']
    },
    bonusSent: {
      type: Boolean,
      default: false
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatMessage'
    },
    redeemed: {
      type: Boolean,
      default: false
    },
    redeemedAt: {
      type: Date
    },
    redeemedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for querying
WheelSpinSchema.index({ campaignId: 1, createdAt: -1 });
WheelSpinSchema.index({ userId: 1, createdAt: -1 });
WheelSpinSchema.index({ sliceId: 1 });
WheelSpinSchema.index({ redeemed: 1 });
WheelSpinSchema.index({ createdAt: -1 });

export default mongoose.model<IWheelSpin>('WheelSpin', WheelSpinSchema);
