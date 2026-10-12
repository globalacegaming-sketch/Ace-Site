import mongoose, { Document, Schema, Types } from 'mongoose';

export type MoneyTransactionType = 'deposit' | 'cashout';
export type MoneyTransactionStatus = 'success' | 'failed' | 'pending';

/**
 * Agent-processed deposits (Fortune Panda recharge) and cash-outs (redeem).
 * "pending" means the provider did not confirm the outcome and an agent must verify it.
 */
export interface IMoneyTransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: MoneyTransactionType;
  amount: number;
  status: MoneyTransactionStatus;
  agentId?: string;
  agentName?: string;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MoneyTransactionSchema = new Schema<IMoneyTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['deposit', 'cashout'], required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['success', 'failed', 'pending'], required: true },
    agentId: { type: String },
    agentName: { type: String },
    message: { type: String, maxlength: 500 }
  },
  { timestamps: true }
);

MoneyTransactionSchema.index({ userId: 1, createdAt: -1 });
MoneyTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });

export default mongoose.model<IMoneyTransaction>('MoneyTransaction', MoneyTransactionSchema);
