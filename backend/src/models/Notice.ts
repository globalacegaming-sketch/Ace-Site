import mongoose, { Document, Schema } from 'mongoose';

export interface INotice extends Document {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isActive: boolean;
  priority: number; // 1-3, only top 3 active notices are shown
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

const NoticeSchema = new Schema<INotice>({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error'],
    default: 'info'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 3
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

NoticeSchema.index({ isActive: 1, priority: 1, createdAt: -1 });
NoticeSchema.index({ expiresAt: 1 });

export default mongoose.model<INotice>('Notice', NoticeSchema);

