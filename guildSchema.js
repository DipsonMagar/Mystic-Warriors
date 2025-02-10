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
    goldBonus: { type: Number, default: 0 } // ✅ Gold bonus for guild perks
});

module.exports = mongoose.model('Guild', guildSchema);
