import mongoose, { Document, Schema } from 'mongoose';

export type LedgerType =
  | 'ISSUE'
  | 'REPAY_CASH'
  | 'REPAY_WINNING'
  | 'REPAY_REFERRAL'
  | 'REPAY_TASK'
  | 'ADJUSTMENT';

export type PaymentMethod =
  | 'CASH'
  | 'WINNING_DEDUCTION'
  | 'REFERRAL_CREDIT'
  | 'TASK_CREDIT'
  | 'MANUAL_ADJUSTMENT';

export interface ILoanLedger extends Document {
  _id: string;
  loanId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: LedgerType;
  amount: number;
  paymentMethod?: PaymentMethod;
  note?: string;
  createdByAgentId: string;
  createdAt: Date;
}

const LoanLedgerSchema = new Schema<ILoanLedger>(
  {
    loanId: {
      type: Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['ISSUE', 'REPAY_CASH', 'REPAY_WINNING', 'REPAY_REFERRAL', 'REPAY_TASK', 'ADJUSTMENT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'WINNING_DEDUCTION', 'REFERRAL_CREDIT', 'TASK_CREDIT', 'MANUAL_ADJUSTMENT'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdByAgentId: {
      type: String,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LoanLedgerSchema.index({ loanId: 1 });
LoanLedgerSchema.index({ userId: 1, createdAt: -1 });
LoanLedgerSchema.index({ type: 1 });
LoanLedgerSchema.index({ createdAt: -1 });

export default mongoose.model<ILoanLedger>('LoanLedger', LoanLedgerSchema);
