import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// The four AceAgent dashboard tabs
export const AGENT_PERMISSIONS = ['chat', 'users', 'verification', 'referrals'] as const;
export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];
export type AgentRole = 'super_admin' | 'admin' | 'agent';

export interface IAgent extends Document {
  agentName: string;
  passwordHash: string;
  role: AgentRole;
  permissions: AgentPermission[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const AgentSchema = new Schema<IAgent>(
  {
    agentName: {
      type: String,
      required: [true, 'Agent name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Agent name must be at least 2 characters'],
      maxlength: [50, 'Agent name cannot exceed 50 characters'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Don't include in queries by default
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'agent'],
      default: 'agent',
      required: true,
    },
    permissions: {
      type: [String],
      enum: AGENT_PERMISSIONS,
      default: [...AGENT_PERMISSIONS], // All permissions by default
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// agentName index created by unique: true on field
AgentSchema.index({ role: 1, isActive: 1 });

// Hash password before saving
AgentSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Compare candidate password against stored hash
AgentSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export default mongoose.model<IAgent>('Agent', AgentSchema);
