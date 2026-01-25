import mongoose, { Document, Schema } from 'mongoose';

/**
 * Crypto deposit transactions via NowPayments.
 * Tracks invoice creation and IPN-based confirmation for idempotent crediting.
 */
export type CryptoTransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface ICryptoTransaction extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  paymentId: string;       // NowPayments payment_id
  invoiceId: string;       // NowPayments invoice_id (if applicable)
  orderId: string;         // Our unique order_id sent to NowPayments
  amount: number;          // USD amount
  currency: string;
  payCurrency?: string;    // e.g. usdttrc20, ltc
  status: CryptoTransactionStatus;
  txHash?: string;
  ipnReceivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CryptoTransactionSchema = new Schema<ICryptoTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    paymentId: {
      type: String,
      required: true,
      index: true
    },
    invoiceId: {
      type: String,
      default: '',
      index: true
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    payCurrency: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
      index: true
    },
    txHash: {
      type: String,
      trim: true
    },
    ipnReceivedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Idempotency: one successful credit per paymentId
CryptoTransactionSchema.index({ paymentId: 1, status: 1 });
CryptoTransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<ICryptoTransaction>('CryptoTransaction', CryptoTransactionSchema);
