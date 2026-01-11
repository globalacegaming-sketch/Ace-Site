import BannedIP from '../models/BannedIP';
import User from '../models/User';
import logger from './logger';

/**
 * Check if an IP address is globally banned
 */
export async function isIPBanned(ip: string): Promise<boolean> {
  try {
    const bannedIP = await BannedIP.findOne({ ip });
    return !!bannedIP;
  } catch (error) {
    logger.error('Error checking if IP is banned:', error);
    return false; // Fail open - don't block if there's an error checking
  }
}

/**
 * Ban an IP address globally
 */
export async function banIP(
  ip: string,
  options?: {
    bannedBy?: string;
    reason?: string;
    userId?: string;
  }
): Promise<void> {
  try {
    // Check if already banned
    const existingBan = await BannedIP.findOne({ ip });
    if (existingBan) {
      logger.debug(`IP ${ip} is already banned`);
      return;
    }

    // Create new ban
    await BannedIP.create({
      ip,
      bannedAt: new Date(),
      bannedBy: options?.bannedBy,
      reason: options?.reason || 'Suspicious activity',
      userId: options?.userId
    });

    logger.info(`IP ${ip} has been globally banned`, {
      bannedBy: options?.bannedBy,
      reason: options?.reason,
      userId: options?.userId
    });
  } catch (error) {
    // If it's a duplicate key error, that's okay (already banned)
    if ((error as any).code === 11000) {
      logger.debug(`IP ${ip} is already banned (duplicate key)`);
      return;
    }
    logger.error(`Error banning IP ${ip}:`, error);
    throw error;
  }
}

/**
 * Ban all IPs associated with a user (lastLoginIP and bannedIPs)
 * and add them to the global banned IP list
 */
export async function banUserIPs(
  userId: string,
  options?: {
    bannedBy?: string;
    reason?: string;
  }
): Promise<string[]> {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User ${userId} not found when trying to ban IPs`);
      return [];
    }

    const ipsToBan: string[] = [];

    // Add lastLoginIP if it exists
    if (user.lastLoginIP) {
      ipsToBan.push(user.lastLoginIP);
    }

    // Add all bannedIPs from the user
    if (user.bannedIPs && user.bannedIPs.length > 0) {
      ipsToBan.push(...user.bannedIPs);
    }

    // Remove duplicates
    const uniqueIPs = [...new Set(ipsToBan)];

    // Ban each IP globally
    for (const ip of uniqueIPs) {
      if (ip && ip.trim() !== '' && ip !== 'unknown') {
        try {
          await banIP(ip, {
            bannedBy: options?.bannedBy,
            reason: options?.reason || 'Associated with banned user',
            userId: userId
          });
        } catch (error) {
          logger.error(`Error banning IP ${ip} for user ${userId}:`, error);
        }
      }
    }

    logger.info(`Banned ${uniqueIPs.length} IP(s) globally for user ${userId}`, {
      ips: uniqueIPs,
      bannedBy: options?.bannedBy
    });

    return uniqueIPs;
  } catch (error) {
    logger.error(`Error banning user IPs for user ${userId}:`, error);
    return [];
  }
}

/**
 * Find all users that have used a specific IP address
 */
export async function findUsersByIP(ip: string): Promise<any[]> {
  try {
    const users = await User.find({
      $or: [
        { lastLoginIP: ip },
        { bannedIPs: { $in: [ip] } }
      ]
    }).select('_id username email firstName lastName lastLoginIP bannedIPs isBanned');

    return users;
  } catch (error) {
    logger.error(`Error finding users by IP ${ip}:`, error);
    return [];
  }
}

