import mongoose, { Document, Schema, Types } from 'mongoose';

export type ChatMessageStatus = 'unread' | 'read' | 'resolved';
export type ChatMessageSender = 'user' | 'admin';

export interface IChatMessage extends Document {
  userId: Types.ObjectId;
  adminId?: Types.ObjectId;
  senderType: ChatMessageSender;
  message?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  status: ChatMessageStatus;
  name?: string;
  email?: string;
  readAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    senderType: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    attachmentUrl: {
      type: String,
      trim: true
    },
    attachmentName: {
      type: String,
      trim: true
    },
    attachmentType: {
      type: String,
      trim: true
    },
    attachmentSize: {
      type: Number
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'resolved'],
      default: 'unread',
      index: true
    },
    name: {
      type: String,
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    readAt: {
      type: Date
    },
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

ChatMessageSchema.index({ userId: 1, createdAt: -1 });
ChatMessageSchema.index({ createdAt: -1 });

export default mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

