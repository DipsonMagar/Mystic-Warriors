const mongoose = require('mongoose');

const marketSchema = new mongoose.Schema({
    sellerId: { type: String, required: true },  // ID of the player selling
    item: { type: String, required: true },      // Item name
    quantity: { type: Number, required: true },  // Quantity of items being sold
    price: { type: Number, required: true },     // Price per item
    listedAt: { type: Date, default: Date.now }, // Timestamp of listing
    itemId: { type: String, required: true, unique: true } // Unique 6-digit item ID
});

// Create a virtual for itemId when creating a listing
marketSchema.pre('save', function(next) {
    if (!this.itemId) {
        this.itemId = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a random 6-digit ID
    }
    next();
});

module.exports = mongoose.model('Market', marketSchema);
