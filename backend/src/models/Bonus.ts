import mongoose, { Document, Schema } from 'mongoose';

export interface IBonus extends Document {
  _id: string;
  title: string;
  description: string;
  image: string; // URL to the bonus image
  bonusType: 'welcome' | 'deposit' | 'free_spins' | 'cashback' | 'other';
  bonusValue?: string; // e.g., "100%", "$50", "50 Free Spins"
  termsAndConditions?: string;
  preMessage?: string; // Message to send via Tawk.to when user claims
  isActive: boolean;
  order: number; // For sorting/ordering bonuses
  validFrom?: Date;
  validUntil?: Date;
  claimedBy: string[]; // Array of user IDs who have claimed this bonus
  createdAt: Date;
  updatedAt: Date;
}

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
  preMessage: {
    type: String,
    trim: true,
    maxlength: [500, 'Pre-message cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  claimedBy: {
    type: [String],
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

// Index for better query performance
BonusSchema.index({ isActive: 1, order: 1 });
BonusSchema.index({ createdAt: -1 });
BonusSchema.index({ validFrom: 1, validUntil: 1 });

export default mongoose.model<IBonus>('Bonus', BonusSchema);

