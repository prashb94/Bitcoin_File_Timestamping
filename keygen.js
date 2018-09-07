var bitcore = require('bitcore-lib');
var HDKey = require('./models/HDKey');
var config = require('./config');
var network;
var HDPrivateKey = bitcore.HDPrivateKey;

if (config.bitcoin_network == "test") {
    network = bitcore.Networks.testnet;
}
else {
    network = bitcore.Networks.livenet;
}

function getPrivateKey() {
    return new Promise((resolve, reject) => {
        HDKey.find({}, (err, keys) => {
            if (err) {
                console.log("Error finding keys ", err);
                reject(err);
            }
            else if (keys.length) {
                console.log("HD Key found : ", keys[0].hdpublic);
                var keyobj = {
                    hdpublic: keys[0].hdpublic,
                    index: keys[0].addressindex,
                    id: keys[0]._id
                };
                resolve(keyobj);
            }
            else {
                console.log("No keys found, creating new HD keypair");
                let hdPrivateKey = new HDPrivateKey(network);
                let hdPublicKey = hdPrivateKey.hdPublicKey;
                var hdkey = new HDKey({
                    hdprivate: hdPrivateKey,
                    hdpublic: hdPublicKey,
                    addressindex: 1
                });
                hdkey.save().then((savedkey) => {
                    console.log("Saved new HD Keypair ", savedkey);
                    var keyobj = {
                        hdpublic: hdPublicKey,
                        index: 1,
                        id: savedkey._id
                    };
                    resolve(keyobj);
                });
            }
        });
    });
}


function getDerivedAddress() {
    return new Promise((resolve, reject) => {
        getPrivateKey().then((keyobj) => {
            let hdPublicKey = keyobj.hdpublic;
            let index = keyobj.index;
            if (hdPublicKey) {
                var derivedAddress = new bitcore.Address(new bitcore.HDPublicKey(hdPublicKey).derive(index).publicKey, network);
                console.log("Generated address = ", derivedAddress);
                let return_obj = {
                    address: derivedAddress,
                    index: index
                };
                HDKey.findByIdAndUpdate(keyobj.id, { addressindex: index + 1 }, (err, res) => {
                    if(err) {
                        console.log("Error updating address index ", err);
                    }
                    else { 
                        console.log("Update address index to " + res.addressindex);
                        resolve(return_obj);
                    }
                });
            }
            else {
                reject("Error getting key from database");
            }
        });
    });
}

module.exports.getDerivedAddress = getDerivedAddress;