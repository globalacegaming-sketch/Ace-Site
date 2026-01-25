import mongoose, { Document, Schema } from 'mongoose';

/**
 * Internal wallet for each user. Balance is in USD.
 * Credited via NowPayments crypto deposits; used for games and adjustable by agents.
 */
export interface IWallet extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    balance: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD']
    }
  },
  { timestamps: true }
);

// Ensure one wallet per user
WalletSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model<IWallet>('Wallet', WalletSchema);
