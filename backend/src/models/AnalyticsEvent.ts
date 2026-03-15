import mongoose, { Document, Schema } from 'mongoose';

export type AnalyticsCategory =
  | 'page'
  | 'click'
  | 'onboarding'
  | 'feature'
  | 'conversion'
  | 'error'
  | 'session';

export interface IAnalyticsEvent extends Document {
  userId?: mongoose.Types.ObjectId;
  sessionId: string;
  eventName: string;
  category: AnalyticsCategory;
  timestamp: Date;
  pageUrl?: string;
  pagePath?: string;
  featureName?: string;
  elementId?: string;
  elementText?: string;
  properties?: Record<string, any>;
  device?: string;
  browser?: string;
  os?: string;
  country?: string;
  screenWidth?: number;
  screenHeight?: number;
  referrer?: string;
  duration?: number;
  scrollDepth?: number;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, required: true, index: true },
    eventName: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['page', 'click', 'onboarding', 'feature', 'conversion', 'error', 'session'],
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    pageUrl: String,
    pagePath: String,
    featureName: String,
    elementId: String,
    elementText: String,
    properties: { type: Schema.Types.Mixed },
    device: String,
    browser: String,
    os: String,
    country: String,
    screenWidth: Number,
    screenHeight: Number,
    referrer: String,
    duration: Number,
    scrollDepth: Number,
  },
  { timestamps: false }
);

AnalyticsEventSchema.index({ category: 1, timestamp: -1 });
AnalyticsEventSchema.index({ eventName: 1, timestamp: -1 });
AnalyticsEventSchema.index({ pagePath: 1, timestamp: -1 });
AnalyticsEventSchema.index({ featureName: 1, timestamp: -1 });
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90-day TTL

export default mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);
