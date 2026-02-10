import mongoose, { Document, Schema } from 'mongoose';

export interface IUserNote extends Document {
  userId: mongoose.Types.ObjectId;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserNoteSchema = new Schema<IUserNote>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    authorId: {
      type: String,
      required: [true, 'Author ID is required'],
    },
    authorName: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
      maxlength: [100, 'Author name cannot exceed 100 characters'],
    },
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
      maxlength: [2000, 'Note content cannot exceed 2000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast per-user note listing
UserNoteSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IUserNote>('UserNote', UserNoteSchema);
