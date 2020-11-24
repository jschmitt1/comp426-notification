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
        makeRequests();
	}
});

function returnToken() {
    var data = fs.readFileSync('/home/bitnami/Stream-Alert/test-sync', { "encoding": "utf8"});
    return data
}


function getAllRecords(callback) {
	streamers.find().toArray(
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
}

function plsWork(item) {
    console.log(returnToken())
    console.log("request made")
    request(({ method: 'GET', json: true, url: 'https://api.twitch.tv/helix/streams?user_id=' + item.streamer_id, headers: {'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': "Bearer " +returnToken()}}), (err, res1, body) => {

        if (res1.body.data.length == 0) {
            if (item.is_live) {
                var newData = {
                    "streamer_name": item.streamer_name,
                    "streamer_id": item.streamer_id,
                    "is_live": false,
                    "subscription_expiration_ms": item.subscription_expiration_ms,
                    "email_list": item.email_list,
                    "text _list": item.text_list,
                    "email_account_list": item.email_account_list,
                    "text_account_list": item.text_account_list
                }
                streamers.updateOne({streamer_id:item.streamer_id}, {$set: newData}, function (x) {});
            }
        }
    })
}

function anotherFunc(i, o, timeout) {
    setTimeout(function(){ 
        // console.log(o)
        var k = (i*20)
        while (k < k+5 && k<o.length) {
            plsWork(o[k]);
            k++
        }
    }, timeout);
}

function makeRequests() {
    getAllRecords(function (e, o) {
        if (o) {
            // console.log(o)
            var count = 0;
            var numOf20s = Math.ceil(o.length/20)
            var i = 0;
            var timeout = 60000;
            console.log("num of 20s" + numOf20s)
            while (i< numOf20s) {
                anotherFunc(i, o, timeout)
                timeout = timeout + 60000
                i++;
            }
        }
    })
}



