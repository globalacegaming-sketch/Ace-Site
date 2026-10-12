import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILoanRequest extends Document {
  _id: Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  requestedAmount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  agentRemarks?: string;
  reviewedByAgentId?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LoanRequestSchema = new Schema<ILoanRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 10,
      max: 100,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    agentRemarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    reviewedByAgentId: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

LoanRequestSchema.index({ userId: 1, status: 1 });
LoanRequestSchema.index({ status: 1, createdAt: -1 });
LoanRequestSchema.index({ createdAt: -1 });
// At most one pending request per user, enforced by the database
LoanRequestSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' }, name: 'one_pending_request_per_user' }
);

export default mongoose.model<ILoanRequest>('LoanRequest', LoanRequestSchema);
