import mongoose, { Document, Schema } from 'mongoose';

export interface IWheelConfig extends Document {
  isEnabled: boolean;
  spinsPerUser: number; // -1 for unlimited, or specific number
  spinsPerDay: number; // -1 for unlimited, or specific number per day
  rewards: {
    betterLuck: number; // Count: 4
    tryAgain: number; // Count: 2
    bonus1: number; // Count: 3
    bonus5: number; // Count: 2
    bonus10: number; // Count: 1
    bonus50Percent: number; // Count: 3
  };
  updatedBy?: string; // Admin username who last updated
  updatedAt: Date;
  createdAt: Date;
}

const WheelConfigSchema = new Schema<IWheelConfig>(
  {
    isEnabled: {
      type: Boolean,
      default: true
    },
    spinsPerUser: {
      type: Number,
      default: 1, // Default: 1 spin per user
      min: -1 // -1 means unlimited
    },
    spinsPerDay: {
      type: Number,
      default: -1, // Default: unlimited per day
      min: -1 // -1 means unlimited
    },
    rewards: {
      betterLuck: {
        type: Number,
        default: 4,
        min: 0
      },
      tryAgain: {
        type: Number,
        default: 2,
        min: 0
      },
      bonus1: {
        type: Number,
        default: 3,
        min: 0
      },
      bonus5: {
        type: Number,
        default: 2,
        min: 0
      },
      bonus10: {
        type: Number,
        default: 1,
        min: 0
      },
      bonus50Percent: {
        type: Number,
        default: 3,
        min: 0
      }
    },
    updatedBy: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one config document exists
WheelConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

export default mongoose.model<IWheelConfig>('WheelConfig', WheelConfigSchema);
