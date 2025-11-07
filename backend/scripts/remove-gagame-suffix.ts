import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';

// Load environment variables
dotenv.config();

async function removeGAGameSuffix() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ace-gaming';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all users with FortunePanda username
    const users = await User.find({
      fortunePandaUsername: { $exists: true, $ne: null }
    });

    console.log(`\n📋 Found ${users.length} users with FortunePanda username`);

    const updates = [];
    const skipped = [];

    for (const user of users) {
      if (!user.fortunePandaUsername) {
        skipped.push({ userId: user._id, reason: 'No username' });
        continue;
      }

      // Check if username ends with _GAGame
      if (user.fortunePandaUsername.endsWith('_GAGame')) {
        // Remove _GAGame suffix
        const newUsername = user.fortunePandaUsername.replace(/_GAGame$/, '');
        
        // Update user
        await User.updateOne(
          { _id: user._id },
          { $set: { fortunePandaUsername: newUsername } }
        );

        updates.push({
          userId: user._id,
          username: user.username,
          oldUsername: user.fortunePandaUsername,
          newUsername: newUsername
        });

        console.log(`✅ Updated ${user.username || user._id}: ${user.fortunePandaUsername} → ${newUsername}`);
      } else {
        skipped.push({ 
          userId: user._id, 
          username: user.username,
          fpUsername: user.fortunePandaUsername,
          reason: 'Does not have _GAGame suffix' 
        });
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updates.length} users`);
    console.log(`   ⏭️  Skipped: ${skipped.length} users`);

    if (updates.length > 0) {
      console.log(`\n📋 Updated users:`);
      updates.forEach(u => {
        console.log(`   - ${u.username || u.userId}: ${u.oldUsername} → ${u.newUsername}`);
      });
    }

    if (skipped.length > 0) {
      console.log(`\n📋 Skipped users:`);
      skipped.forEach(s => {
        console.log(`   - ${s.username || s.userId}: ${s.fpUsername || 'N/A'} (${s.reason})`);
      });
    }

    console.log('\n✅ Update completed successfully!');
  } catch (error) {
    console.error('❌ Error during update:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the update
removeGAGameSuffix()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

