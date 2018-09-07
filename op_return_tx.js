var bitcore = require('bitcore-lib');
var Insight = require("bitcore-explorers").Insight;
var insight = new Insight("testnet");
var utxoSet;
var HDKey = require('./models/HDKey');

function sendTx(data, index) {
    return new Promise((resolve, reject) => {
        HDKey.find({}, (err, key) => {
            var hdprivateKey = new bitcore.HDPrivateKey(key[0].hdprivate);
            var signing_key = hdprivateKey.derive(parseInt(index)).privateKey;
            var derived_address = signing_key.toAddress(bitcore.Networks.testnet);
            console.log("Derived address = " + derived_address);
            //TODO: Assert addresses here
            insight.getUnspentUtxos(derived_address, function (error, utxos) {
                if (error) {
                    console.log(error);
                } else if(utxos.length) {
                    console.log("Got utxos ", utxos);
                    utxoSet = utxos;
                    tx = new bitcore.Transaction().from(utxoSet[0]).addData(data).sign(signing_key);
                    console.log(tx.toObject());
                    insight.broadcast(tx, function (err, txId) {
                        console.log(err);
                        console.log("Broadcasted timestamping data! ", txId);
                        resolve(txId);
                    });
                }
            });
        });
    });
}

module.exports.sendTx = sendTx;

