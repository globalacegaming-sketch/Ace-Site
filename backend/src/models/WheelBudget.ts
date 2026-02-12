import mongoose, { Document, Schema, Types } from 'mongoose';

export type BudgetMode = 'auto' | 'target_expense' | 'manual';

export interface IWheelBudget extends Document {
  campaignId: Types.ObjectId;
  mode: BudgetMode;
  
  // Common to all modes
  totalBudget: number;
  budgetRemaining: number;
  budgetSpent: number;
  
  // Mode A - Auto
  targetSpins?: number;
  
  // Mode B - Target Expense Rate
  targetExpensePerDay?: number;
  targetExpensePerSpins?: number; // e.g., $ per 10 spins
  targetExpenseSpinsInterval?: number; // e.g., 10
  
  // Mode C - Manual (no additional fields, just manual limits per slice)
  
  // Tracking
  totalSpins: number;
  averagePayoutPerSpin: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const WheelBudgetSchema = new Schema<IWheelBudget>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'WheelCampaign',
      required: true,
      unique: true
    },
    mode: {
      type: String,
      enum: ['auto', 'target_expense', 'manual'],
      required: true,
      default: 'auto'
    },
    totalBudget: {
      type: Number,
      required: true,
      min: [0, 'Total budget cannot be negative']
    },
    budgetRemaining: {
      type: Number,
      required: true,
      min: [0, 'Budget remaining cannot be negative']
    },
    budgetSpent: {
      type: Number,
      default: 0,
      min: [0, 'Budget spent cannot be negative']
    },
    targetSpins: {
      type: Number,
      min: [1, 'Target spins must be at least 1']
    },
    targetExpensePerDay: {
      type: Number,
      min: [0, 'Target expense per day cannot be negative']
    },
    targetExpensePerSpins: {
      type: Number,
      min: [0, 'Target expense per spins cannot be negative']
    },
    targetExpenseSpinsInterval: {
      type: Number,
      min: [1, 'Target expense spins interval must be at least 1']
    },
    totalSpins: {
      type: Number,
      default: 0,
      min: [0, 'Total spins cannot be negative']
    },
    averagePayoutPerSpin: {
      type: Number,
      default: 0,
      min: [0, 'Average payout per spin cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

WheelBudgetSchema.index({ campaignId: 1 });
WheelBudgetSchema.index({ createdAt: -1 });

export default mongoose.model<IWheelBudget>('WheelBudget', WheelBudgetSchema);

