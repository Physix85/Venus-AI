import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Chat from '../models/Chat.js';

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user statistics
    const chatCount = await Chat.countDocuments({ userId: req.user.id });
    const totalMessages = await Chat.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: null, total: { $sum: '$statistics.messageCount' } } }
    ]);
    
    const userProfile = {
      ...user.toObject(),
      statistics: {
        chatCount,
        totalMessages: totalMessages[0]?.total || 0,
        memberSince: user.createdAt
      }
    };
    
    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { username, email, firstName, lastName, bio, preferences } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if username is already taken (if changed)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      user.username = username;
    }
    
    // Check if email is already taken (if changed)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already taken' });
      }
      user.email = email;
    }
    
    // Update other fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (bio !== undefined) user.bio = bio;
    
    // Update preferences
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences
      };
    }
    
    user.updatedAt = new Date();
    await user.save();
    
    // Return user without password
    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Change password
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    user.password = hashedNewPassword;
    user.updatedAt = new Date();
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update user preferences
router.put('/preferences', async (req, res) => {
  try {
    const { preferences } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update preferences
    user.preferences = {
      ...user.preferences,
      ...preferences
    };
    
    user.updatedAt = new Date();
    await user.save();
    
    res.json(user.preferences);
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get user statistics
router.get('/statistics', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get chat statistics
    const chatStats = await Chat.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          totalMessages: { $sum: '$statistics.messageCount' },
          totalTokens: { $sum: '$statistics.totalTokens' }
        }
      }
    ]);
    
    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivity = await Chat.aggregate([
      { 
        $match: { 
          userId: userId,
          'statistics.lastActivity': { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$statistics.lastActivity'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Get model usage statistics
    const modelStats = await Chat.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$settings.model',
          count: { $sum: 1 },
          totalTokens: { $sum: '$statistics.totalTokens' }
        }
      }
    ]);
    
    const statistics = {
      overview: {
        totalChats: chatStats[0]?.totalChats || 0,
        totalMessages: chatStats[0]?.totalMessages || 0,
        totalTokens: chatStats[0]?.totalTokens || 0
      },
      recentActivity,
      modelUsage: modelStats
    };
    
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Delete user account
router.delete('/account', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Password is incorrect' });
    }
    
    // Delete all user's chats
    await Chat.deleteMany({ userId: req.user.id });
    
    // Delete user account
    await User.findByIdAndDelete(req.user.id);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({ error: 'Failed to delete user account' });
  }
});

// Get user's shared chats
router.get('/shared-chats', async (req, res) => {
  try {
    const sharedChats = await Chat.find({ 
      userId: req.user.id,
      isShared: true 
    })
    .select('title createdAt updatedAt messageCount')
    .sort({ updatedAt: -1 });
    
    res.json(sharedChats);
  } catch (error) {
    console.error('Error fetching shared chats:', error);
    res.status(500).json({ error: 'Failed to fetch shared chats' });
  }
});

export default router;
