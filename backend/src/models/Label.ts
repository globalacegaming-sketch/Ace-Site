import mongoose, { Document, Schema } from 'mongoose';

export interface ILabel extends Document {
  name: string;
  color: string;
  sortOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Default palette for label colors
export const LABEL_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
  '#14B8A6', // teal
] as const;

const LabelSchema = new Schema<ILabel>(
  {
    name: {
      type: String,
      required: [true, 'Label name is required'],
      unique: true,
      trim: true,
      maxlength: [30, 'Label name cannot exceed 30 characters'],
    },
    color: {
      type: String,
      required: true,
      default: '#3B82F6',
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
  },
  {
    timestamps: true,
  }
);

// name index created by unique: true on field
LabelSchema.index({ sortOrder: 1 });

export default mongoose.model<ILabel>('Label', LabelSchema);
