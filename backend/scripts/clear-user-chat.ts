/**
 * One-off: delete all chat messages for a user by email.
 * Usage: npx ts-node scripts/clear-user-chat.ts titan123@gmail.com
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import User from '../src/models/User';
import ChatMessage from '../src/models/ChatMessage';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const email = (process.argv[2] || 'titan123@gmail.com').trim().toLowerCase();

async function main() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/global-ace-gaming';
  await mongoose.connect(mongoURI);

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  const result = await ChatMessage.deleteMany({ userId: user._id });

  console.log(`Cleared chat for ${name} (${email})`);
  console.log(`Deleted ${result.deletedCount} message(s).`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
