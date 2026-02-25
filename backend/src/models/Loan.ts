import mongoose, { Document, Schema } from 'mongoose';

export interface ILoan extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  principalAmount: number;
  remainingBalance: number;
  issuedAt: Date;
  dueAt: Date;
  status: 'ACTIVE' | 'PAID' | 'OVERDUE';
  approvedRequestId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema = new Schema<ILoan>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    principalAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    remainingBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PAID', 'OVERDUE'],
      default: 'ACTIVE',
    },
    approvedRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'LoanRequest',
      required: true,
    },
  },
  { timestamps: true }
);

LoanSchema.index({ userId: 1, status: 1 });
LoanSchema.index({ status: 1 });
LoanSchema.index({ dueAt: 1, status: 1 });
LoanSchema.index({ createdAt: -1 });

export default mongoose.model<ILoan>('Loan', LoanSchema);
