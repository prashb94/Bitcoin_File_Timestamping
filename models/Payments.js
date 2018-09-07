var mongoose = require('mongoose');

var paymentSchema = mongoose.Schema({
    address : String,
    amount : Number,
    date : Date,
    hash : String,
    fileHash : String,
    fileId : String
});

module.exports = mongoose.model('Payments', paymentSchema);