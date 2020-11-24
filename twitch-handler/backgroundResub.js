const express = require('express')
var bodyParser = require('body-parser');
var request = require('request');
const app = express();
var session = require('express-session');
const MongoClient 	= require('mongodb').MongoClient;
var MongoStore = require('connect-mongo')(session);
const fs = require('fs');
app.use(bodyParser.json());


// build mongo database connection url //

process.env.DB_HOST = process.env.DB_HOST || 'localhost'
process.env.DB_PORT = process.env.DB_PORT || 27017;
process.env.DB_NAME = process.env.DB_NAME || 'node-login';

if (app.get('env') != 'live'){
	process.env.DB_URL = 'mongodb://'+process.env.DB_HOST+':'+process.env.DB_PORT;
}	else {
// prepend url with authentication credentials // 
	process.env.DB_URL = 'mongodb://'+process.env.DB_USER+':'+process.env.DB_PASS+'@'+process.env.DB_HOST+':'+process.env.DB_PORT;
}

process.env.DB_URL = 'mongodb+srv://admin:'+process.env.MONGO_PASS+'@cluster0-6scoy.mongodb.net/test?retryWrites=true&w=majority';
app.use(session({
	secret: 'faeb4453e5d14fe6f6d04637f78077c76c73d1b4',
	proxy: true,
	resave: true,
	saveUninitialized: true,
	store: new MongoStore({ url: process.env.DB_URL })
	})
);

var db, streamers;
MongoClient.connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true }, function(e, client) {
	if (e){
		console.log(e);
	}	else{
		db = client.db("node-login");
		streamers = db.collection('Streamers');
        console.log('mongo :: connected to database :: "'+"node-login"+'"');
        // should wait 2-3 minutes
        setTimeout(function(){ 
            wait1();
        }, 60000)

	}
});


function getAllRecords(callback) {
	streamers.find().toArray(
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
}

var count = 0;
function wait1() {
    getAllRecords(function (e, o) {
        if (o) {
            var d = new Date();
            var n = d.getTime();
            o.sort(function(l,r) {
                return l.subscription_expiration_ms - r.subscription_expiration_ms;
            })
            var i =0;
            while (i<20 && i < o.length) {
                if (o[i].subscription_expiration_ms < n) {
                    var sendMsg = {
                        "id": o[i].streamer_id
                    }
                    request(({ method: 'POST', json: sendMsg, url: 'http://3.88.71.149:8000/resub', headers: {}}), (err, res1, body) => {
                        console.log("sent resub request");
                    })
                }
                i++;
            }
        }
    })
    // every 2 days request new token 
    if (count % 24 | count == 0) {
        request(({ method: 'POST', json: true, url: 'https://id.twitch.tv/oauth2/token?client_id='+process.env.TWITCH_CLIENT_ID+'&client_secret='+process.env.TWITCH_SECRET+'&grant_type=client_credentials', headers: {}}), (err, res1, body) => {
            token = res1.body.access_token;
            fs.writeFileSync('/home/bitnami/Stream-Alert/test-sync', token);
       })
    }
    count++;
    setTimeout(function(){ 
        wait1();
    }, 7200000)
}

