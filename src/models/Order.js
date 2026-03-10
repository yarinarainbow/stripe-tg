const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    index: true,
  },
  tariffName: {
    type: String,
    required: true,
    enum: ['level1', 'level2', 'course'],
  },
  stripeSessionId: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Order', orderSchema);
