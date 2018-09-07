var mongoose = require('mongoose');

var KeySchema = mongoose.Schema({
    hdprivate : String,
    hdpublic : String,
    addressindex: Number
});

module.exports = mongoose.model('keys', KeySchema);