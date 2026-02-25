import mongoose, { Document, Schema } from 'mongoose';

export type LoanAgentAction =
  | 'APPROVE'
  | 'REJECT'
  | 'REPAYMENT'
  | 'LIMIT_CHANGE'
  | 'MANUAL_ISSUE';

export interface ILoanAgentLog extends Document {
  _id: string;
  agentId: string;
  action: LoanAgentAction;
  targetUserId: mongoose.Types.ObjectId;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const LoanAgentLogSchema = new Schema<ILoanAgentLog>(
  {
    agentId: { type: String, required: true },
    action: {
      type: String,
      enum: ['APPROVE', 'REJECT', 'REPAYMENT', 'LIMIT_CHANGE', 'MANUAL_ISSUE'],
      required: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LoanAgentLogSchema.index({ agentId: 1, createdAt: -1 });
LoanAgentLogSchema.index({ targetUserId: 1, createdAt: -1 });
LoanAgentLogSchema.index({ action: 1, createdAt: -1 });
LoanAgentLogSchema.index({ createdAt: -1 });

export default mongoose.model<ILoanAgentLog>('LoanAgentLog', LoanAgentLogSchema);
