import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatform extends Document {
  _id: string;
  name: string;
  description: string;
  image: string; // URL to the platform image
  gameLink: string; // URL to the game/platform
  isActive: boolean;
  order: number; // For sorting/ordering platforms
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSchema = new Schema<IPlatform>({
  name: {
    type: String,
    required: [true, 'Platform name is required'],
    trim: true,
    maxlength: [100, 'Platform name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Platform description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    required: [true, 'Platform image is required'],
    trim: true
  },
  gameLink: {
    type: String,
    required: [true, 'Game link is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
PlatformSchema.index({ isActive: 1, order: 1 });
PlatformSchema.index({ createdAt: -1 });

export default mongoose.model<IPlatform>('Platform', PlatformSchema);

