import mongoose, { Document, Schema } from 'mongoose';

export interface ILoanLimitHistory extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  oldLimit: number;
  newLimit: number;
  changedByAgentId: string;
  createdAt: Date;
}

const LoanLimitHistorySchema = new Schema<ILoanLimitHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    oldLimit: {
      type: Number,
      required: true,
    },
    newLimit: {
      type: Number,
      required: true,
    },
    changedByAgentId: {
      type: String,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LoanLimitHistorySchema.index({ userId: 1, createdAt: -1 });
LoanLimitHistorySchema.index({ changedByAgentId: 1 });
LoanLimitHistorySchema.index({ createdAt: -1 });

export default mongoose.model<ILoanLimitHistory>('LoanLimitHistory', LoanLimitHistorySchema);
