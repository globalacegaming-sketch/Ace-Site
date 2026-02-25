import mongoose, { Document, Schema } from 'mongoose';

export interface ILoanAccount extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  loanLimit: number;
  activeBalance: number;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

const LoanAccountSchema = new Schema<ILoanAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    loanLimit: {
      type: Number,
      default: 20,
      min: 20,
      max: 500,
    },
    activeBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

LoanAccountSchema.index({ userId: 1 }, { unique: true });
LoanAccountSchema.index({ status: 1 });

export default mongoose.model<ILoanAccount>('LoanAccount', LoanAccountSchema);
