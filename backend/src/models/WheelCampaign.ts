import mongoose, { Document, Schema } from 'mongoose';

export type CampaignStatus = 'draft' | 'live' | 'paused';

export interface IWheelCampaign extends Document {
  campaignName: string;
  status: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WheelCampaignSchema = new Schema<IWheelCampaign>(
  {
    campaignName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Campaign name cannot exceed 100 characters']
    },
    status: {
      type: String,
      enum: ['draft', 'live', 'paused'],
      default: 'draft'
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one active campaign exists
WheelCampaignSchema.index({ status: 1 });
WheelCampaignSchema.index({ createdAt: -1 });

export default mongoose.model<IWheelCampaign>('WheelCampaign', WheelCampaignSchema);

