import mongoose, { Document, Schema } from 'mongoose';

export type SupportTicketCategory = 
  | 'payment_related_queries'
  | 'game_issue'
  | 'complaint'
  | 'feedback'
  | 'business_queries';

export type SupportTicketStatus = 
  | 'pending'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface ISupportTicket extends Document {
  _id: string;
  userId?: mongoose.Types.ObjectId; // Optional for non-logged-in users
  ticketNumber: string; // Unique ticket number
  category: SupportTicketCategory;
  description: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  
  // User information (required for non-logged-in users, auto-filled for logged-in)
  name: string;
  email: string;
  phone?: string;
  
  status: SupportTicketStatus;
  assignedTo?: mongoose.Types.ObjectId; // Agent/admin who is handling it
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  notes?: string; // Internal notes from agents
  
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  category: {
    type: String,
    enum: ['payment_related_queries', 'game_issue', 'complaint', 'feedback', 'business_queries'],
    required: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
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
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [120, 'Name cannot exceed 120 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    default: 'pending',
    index: true
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ category: 1, status: 1 });
SupportTicketSchema.index({ email: 1, createdAt: -1 });

// Generate unique ticket number before saving
SupportTicketSchema.pre('save', async function(next) {
  if (!this.ticketNumber) {
    try {
      // Use mongoose.models to access the registered model
      const SupportTicketModel = mongoose.models.SupportTicket || mongoose.model('SupportTicket');
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!isUnique && attempts < maxAttempts) {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.ticketNumber = `TKT-${timestamp}-${random}`;
        
        // Check for uniqueness
        try {
          const existing = await SupportTicketModel.findOne({ ticketNumber: this.ticketNumber });
          if (!existing) {
            isUnique = true;
          } else {
            attempts++;
            // Small delay to ensure different timestamp if regenerating quickly
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        } catch (checkError) {
          // If there's an error checking, proceed anyway - the unique index will catch duplicates
          isUnique = true;
        }
      }
      
      // If we still don't have a unique ticket number after max attempts, use a longer random string
      if (!isUnique) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        this.ticketNumber = `TKT-${timestamp}-${random}`;
      }
    } catch (error) {
      // Fallback: generate a simple ticket number if model lookup fails
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      this.ticketNumber = `TKT-${timestamp}-${random}`;
    }
  }
  next();
});

export default mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

