var fs = require('fs');
var express = require('express');
var mongoose = require('mongoose');
var Image = require('./models/ImageModel');
var multer = require('multer');
var crypto = require('crypto');
var mime = require('mime');
var keygen = require('./keygen');
var exphbs = require('express-handlebars');
var send_op_return_tx = require('./op_return_tx');
var io;
var namespace;

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/bitcoin_timestamping', (err, connection) => {
	if (err)
		console.log(err);
	else
		console.log("Connected to mongodb...");
});

var config = require('./config');
var poll = require('./poll');
var poll_interval = 5000;
var current_filename = "";

var host = "api.blockcypher.com";
var path = "/v1/btc/test3";

var app = express();

app.use(express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');
app.engine('handlebars', exphbs({ defaultLayout: 'layout' }));
app.set('view engine', 'handlebars');

function fileHash(filename, algorithm = 'sha256') {
	return new Promise((resolve, reject) => {
		let shasum = crypto.createHash(algorithm);
		try {
			let file = fs.ReadStream(filename);
			file.on('data', function (data) {
				shasum.update(data);
			})
			file.on('end', function () {
				const hash = shasum.digest('hex');
				namespace = hash.toString().substring(0, 6);
				console.log("File hash = ", hash);
				return resolve(hash);
			})
		} catch (error) {
			return reject('Cannot hash file...');
		}
	});
}

function saveFileToDb(filename) {
	return new Promise((resolve, reject) => {
		var file_path = __dirname + '/static/files/' + filename;
		var imageData = fs.readFileSync(file_path);
		fileHash(file_path).then((hash) => {
			const image = new Image({
				filename: filename,
				data: imageData,
				hash: hash,
				txhash: "",
				date: new Date()
			});
			image.save().then(img => {
				console.log("Saved image to MongoDB ");
				resolve(hash);
				fs.unlink(file_path, (err) => {
					if (err)
						console.log("Error deleting original file ", err);
				});
			}).catch(err => {
				console.log(err);
				throw err;
			});
		});
	});
}

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, './static/files/')
	},
	filename: function (req, file, cb) {
		crypto.pseudoRandomBytes(16, function (err, raw) {
			var filename = raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype);
			current_filename = filename;
			console.log("Filename = ", filename);
			cb(null, filename);
		});
	}
});

var upload = multer({ storage: storage });

app.get('/', (req, res) => {
	res.render('index');
});

app.post('/upload-file', upload.single('file-to-upload'), (req, res) => {
	var address = keygen.getDerivedAddress();
	address.then((address_obj) => {
		let address = address_obj.address;
		let index = address_obj.index;
		console.log("Received Address = " + address);
		res.redirect('/pay?address=' + address + '&amount=' + config.amount + '&filename=' + current_filename + '&index=' + index);
	});
});

app.get('/get-file', (req, res) => {
	let tx_hash = req.query.txhash;
	console.log("Finding image with txhash = ", tx_hash);
	Image.findOne({txhash: tx_hash}, (err, image) => {
		if(err)
		{
			console.log("Error retrieving file ", err);
		}
		else if(image != null)
		{
			fs.writeFileSync(__dirname + '/static/tmp/' + image.filename, image.data);
			fs.readFile(__dirname + '/static/tmp/' + image.filename, function(err, data) {
				res.writeHead(200, {'Content-Type': 'image/jpeg'});
				res.end(data); 
			});
		}
		else {
			res.send("Invalid hash!");
		}
	});
});

app.get('/pay', (req, res) => {
	var address = req.query.address;
	var amount = req.query.amount;
	var filename = req.query.filename;
	var index = req.query.index;
	var qrURL = "https://chart.googleapis.com/chart?chs=200x200&chld=L|2&cht=qr&chl=bitcoin:" + address + "?amount=" + amount + "%26label=btc_timestamp";
	let requestObject = {
		host: host,
		path: path + '/addrs/' + address + '/full', // test with mj9YseuxoGcGw8geYVC8RgPRVDBextAZky
		method: 'GET'
	};
	console.log("Starting polling interval = ", config.interval);
	let namespace_connection = io.of('/test');
	poll_interval = setInterval(() => {
		let poll_result = poll(requestObject);
		poll_result.then((result) => {
			console.log("Poll result = ", JSON.stringify(result));
			namespace_connection.emit('conf', result);
			if(result != 0 && result.tx[0] != undefined)
			{
				if(result.tx[0].confirmations > 0) {
					clearInterval(poll_interval);
					var hash = saveFileToDb(filename);
					hash.then((file_hash) => {
						send_op_return_tx.sendTx(file_hash, index).then((tx_hash) => {
							console.log("Transaction hash = ", tx_hash);
							namespace_connection.emit('data_hash', {data_bc_hash: tx_hash});
							Image.findOneAndUpdate({hash: file_hash}, {txhash: tx_hash, date: new Date()}, (err, updatedDoc) => {
								if(err)
								console.log(err);
								else
								console.log("Updated document with tx hash! ", updatedDoc);
							});
						});
					});
				}
			}
		});
	}, config.interval);
	res.render('pay', { qr: qrURL, amount: config.amount, address: address, ns: namespace });
});

var server = app.listen(3000, function(){
	console.log('Listening on port 3000');
});

io = require('socket.io')(server);
