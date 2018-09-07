const mongoose = require('mongoose');
 
const ImageSchema = mongoose.Schema({
    filename: String,
    data: Buffer,
    hash: String,
    txhash: String,
    date: Date
});
 
module.exports = mongoose.model('Image', ImageSchema);