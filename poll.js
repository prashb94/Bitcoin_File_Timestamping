var https = require('https');

function resultObject(){
  this.balance = 0;
  this.unconfirmed_balance = 0;
  this.final_balance = 0;
  this.n_tx = 0;
  this.tx = [];
  this.getNumberOfConfirmationsForTx = function getNumberOfConfirmationsForTx(index){
    return this.tx[index].confirmations;
  }
  this.getTxHash = function getTxHash(index){
    return this.tx[index].hash;
  }
  this.getTxValue = function getTxValue(index){
    return this.tx[index].value;
  }
}

function parseContent(content, resolve) {
	content = JSON.parse(content);
  if(content.final_n_tx == 0){
    resolve(0);
    return;
  }
  if(content.error){
    resolve({error: content.error});
  }
  var returnObject = new resultObject();
  returnObject.balance = content.balance;
  returnObject.unconfirmed_balance = content.unconfirmed_balance;
  returnObject.final_balance = content.final_balance;
  returnObject.n_tx = content.final_n_tx;
	var transactions = content.txs;
	for(var i = 0; i < content.final_n_tx; i++){
    var txObj = {};
    txObj.confirmations = transactions[i].confirmations;
    txObj.hash = transactions[i].hash;
    // Iterate over all transaction outputs for that transaction
		var txOutputs = transactions[i].outputs;
		for(var j = 0; j < txOutputs.length; j++){
      // Iterate over all addresses involved in that output
      var addresses = txOutputs[j].addresses;
      for(var k = 0; k < addresses.length; k++){
        if(addresses[k] == content.address){
          txObj.value = txOutputs[j].value; // In satoshis
        }
      }
		}
    returnObject.tx.push(txObj);
	}
  resolve(returnObject);
}

module.exports = function (requestObject) {
  return new Promise(function(resolve, reject){
    var reqGet = https.request(requestObject, function (res) {
    var content = "";
      res.on('data', function (chunk) {
        content += chunk;
      });
      res.on('end', function(){
        parseContent(content, resolve);
      });
    });
    reqGet.end();
    reqGet.on('error', function (e) {
      console.error(e);
      reject(e);
    });
  });
  }