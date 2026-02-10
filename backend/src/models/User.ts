import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: string;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  country?: string;
  currency?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  role: 'user' | 'admin' | 'moderator';
  lastLogin?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  fortunePandaUsername?: string;
  fortunePandaPassword?: string;
  fortunePandaBalance?: number;
  fortunePandaLastSync?: Date;

  // Two-Factor Authentication
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];

  // Bonus Spins (earned from Free Spin wins & streak rewards)
  bonusSpins: number;

  // Daily Login Streak
  loginStreak: number;
  lastLoginDate?: Date;
  loginStreakRewardsClaimed: number[];

  // Achievements / Badges
  achievements: {
    id: string;
    name: string;
    description: string;
    icon: string;
    earnedAt: Date;
  }[];

  // CRM Labels
  labels: mongoose.Types.ObjectId[];

  referralCode?: string;
  referredBy?: string;
  isBanned?: boolean;
  bannedIPs?: string[];
  bannedAt?: Date;
  banReason?: string;
  lastLoginIP?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  avatar: {
    type: String,
    default: 'gorilla',
    enum: ['gorilla', 'lion', 'tiger', 'eagle', 'shark', 'wolf', 'bear', 'dragon']
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value: Date) {
        return value < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  country: {
    type: String,
    trim: true,
    maxlength: [100, 'Country name cannot exceed 100 characters']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN']
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  lastLogin: {
    type: Date
  },
  fortunePandaUsername: {
    type: String,
    trim: true
  },
  fortunePandaPassword: {
    type: String,
    select: false // Don't include in queries by default
  },
  fortunePandaBalance: {
    type: Number,
    default: 0
  },
  fortunePandaLastSync: {
    type: Date
  },
  // CRM Labels (references to Label model)
  labels: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Label' }],
    default: [],
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9]{6,12}$/, 'Referral code must be 6-12 characters and contain only letters and numbers']
  },
  referredBy: {
    type: String,
    trim: true
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  bannedIPs: {
    type: [String],
    default: []
  },
  bannedAt: {
    type: Date
  },
  banReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Ban reason cannot exceed 500 characters']
  },
  lastLoginIP: {
    type: String,
    trim: true
  },
  // Two-Factor Authentication
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  twoFactorBackupCodes: {
    type: [String],
    select: false
  },
  // Bonus Spins (earned from Free Spin wins & streak rewards)
  bonusSpins: {
    type: Number,
    default: 0,
    min: 0
  },
  // Daily Login Streak
  loginStreak: {
    type: Number,
    default: 0
  },
  lastLoginDate: {
    type: Date
  },
  loginStreakRewardsClaimed: {
    type: [Number],
    default: []
  },
  // Achievements / Badges
  achievements: {
    type: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      description: { type: String, required: true },
      icon: { type: String, required: true },
      earnedAt: { type: Date, default: Date.now }
    }],
    default: []
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      const { password, ...rest } = ret;
      return rest;
    }
  }
});

// Indexes for better query performance
// email and username already indexed by unique: true
// referralCode already indexed by unique: true (sparse)

// Index for sorting by creation date
UserSchema.index({ createdAt: -1 });

// Index for referral lookups
UserSchema.index({ referredBy: 1 });

// Index for Fortune Panda username lookups
UserSchema.index({ fortunePandaUsername: 1 }, { sparse: true });

// Index for active user filtering
UserSchema.index({ isActive: 1 });

// Compound index for common queries: active users sorted by creation
UserSchema.index({ isActive: 1, createdAt: -1 });

// Compound index for email verification lookups
UserSchema.index({ emailVerificationToken: 1 }, { sparse: true });

// Compound index for password reset lookups
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });

// Index for banned users
UserSchema.index({ isBanned: 1 });

// Multikey index for label-based filtering
UserSchema.index({ labels: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

export default mongoose.model<IUser>('User', UserSchema);
