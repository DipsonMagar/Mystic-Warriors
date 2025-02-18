const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    level: { type: Number, default: 1 },
    description: { type: String, default: "Welcome to the guild!" },
    members: [{ type: String }], // Array of user IDs
    leader: { type: String, required: true }, // Leader's user ID
    banner: { type: String, default: 'https://default-guild-banner-url.com' },
    verified: { type: Boolean, default: false },
    lastRewarded: { type: Date, default: null },
    invites: [{ type: String }],
    goldBonus: { type: Number, default: 0 }, // ✅ Gold bonus for guild perks

    // ✅ New bank field to track total donations
    bank: {
        coins: { type: Number, default: 0 },
        gems: { type: Number, default: 0 }
    },

    guildPoints: { type: Number, default: 0 },  // Weekly Guild Points
    memberPoints: { type: Map, of: Number, default: {} } // Individual Contributions

    
});

module.exports = mongoose.model('Guild', guildSchema);
