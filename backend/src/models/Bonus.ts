import mongoose, { Document, Schema } from 'mongoose';

export interface IBonusClaim {
  userId: string;
  claimedAt: Date;
}

export interface IBonus extends Document {
  _id: string;
  title: string;
  description: string;
  image: string;
  bonusType: 'welcome' | 'deposit' | 'free_spins' | 'cashback' | 'other';
  bonusValue?: string;
  termsAndConditions?: string;
  isActive: boolean;
  order: number;
  validFrom?: Date;
  validUntil?: Date;
  maxClaims: number;       // max times a user can claim (0 = unlimited)
  cooldownHours: number;   // hours before re-claim (0 = one-time only)
  claimedBy: string[];     // legacy — unique user IDs who have ever claimed
  claims: IBonusClaim[];   // detailed claim log with timestamps
  createdAt: Date;
  updatedAt: Date;
}

const BonusClaimSchema = new Schema({
  userId:    { type: String, required: true },
  claimedAt: { type: Date, default: Date.now }
}, { _id: false });

const BonusSchema = new Schema<IBonus>({
  title: {
    type: String,
    required: [true, 'Bonus title is required'],
    trim: true,
    maxlength: [100, 'Bonus title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Bonus description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  image: {
    type: String,
    required: [true, 'Bonus image is required'],
    trim: true
  },
  bonusType: {
    type: String,
    enum: ['welcome', 'deposit', 'free_spins', 'cashback', 'other'],
    default: 'other'
  },
  bonusValue: {
    type: String,
    trim: true
  },
  termsAndConditions: {
    type: String,
    trim: true,
    maxlength: [2000, 'Terms and conditions cannot exceed 2000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxClaims: {
    type: Number,
    default: 1,
    min: 0
  },
  cooldownHours: {
    type: Number,
    default: 0,
    min: 0
  },
  claimedBy: {
    type: [String],
    default: []
  },
  claims: {
    type: [BonusClaimSchema],
    default: []
  },
  order: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date
  },
  validUntil: {
    type: Date
  }
}, {
  timestamps: true
});

BonusSchema.index({ isActive: 1, order: 1 });
BonusSchema.index({ createdAt: -1 });
BonusSchema.index({ validFrom: 1, validUntil: 1 });
BonusSchema.index({ 'claims.userId': 1 });

export default mongoose.model<IBonus>('Bonus', BonusSchema);

