import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWheelFairnessRules extends Document {
  campaignId: Types.ObjectId;
  
  // Spin Limits
  spinsPerUser: number; // -1 for unlimited
  
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
      unique: true,
      index: true
    },
    spinsPerUser: {
      type: Number,
      default: 1,
      min: [-1, 'Spins per user must be -1 (unlimited) or positive']
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

