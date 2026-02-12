import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWheelFairnessRules extends Document {
  campaignId: Types.ObjectId;
  
  // Spin Limits
  spinsPerDay: number;   // Daily cap (resets at midnight). -1 = unlimited
  
  // Free Spin Rules
  // maxFreeSpinsPerUser is hardcoded to 1 per 24 hours in the service
  freeSpinCannotTriggerFreeSpin: boolean; // Default: true
  
  createdAt: Date;
  updatedAt: Date;
}

const WheelFairnessRulesSchema = new Schema<IWheelFairnessRules>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'WheelCampaign',
      required: true,
      unique: true
    },
    spinsPerDay: {
      type: Number,
      default: 2,
      min: [-1, 'Spins per day must be -1 (unlimited) or positive']
    },
    freeSpinCannotTriggerFreeSpin: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

WheelFairnessRulesSchema.index({ campaignId: 1 });
WheelFairnessRulesSchema.index({ createdAt: -1 });

export default mongoose.model<IWheelFairnessRules>('WheelFairnessRules', WheelFairnessRulesSchema);

