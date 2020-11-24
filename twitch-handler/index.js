const express = require('express')
var bodyParser = require('body-parser');
var request = require('request');
const fs = require('fs');
var spawn= require('child_process').spawn;
const app = express();
var session = require('express-session');
const MongoClient 	= require('mongodb').MongoClient;
var MongoStore = require('connect-mongo')(session);
app.use(bodyParser.json());
var out = fs.openSync('./out.log', 'a');
var err = fs.openSync('./out.log', 'a');
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.AUTH_TOKEN;
const client2 = require('twilio')(accountSid, authToken);


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
		console.log(e)
	}	else{
		db = client.db("node-login");
		streamers = db.collection('Streamers');
    // index fields 'user' & 'email' for faster new account validation //
        streamers.createIndex({streamer_id: 1, streamer_name: 1});
        console.log('mongo :: connected to database :: "'+"node-login"+'"');
	}
});



function getAllRecords(callback) {
	streamers.find().toArray(
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
}

function returnToken() {
    var data = fs.readFileSync('/home/bitnami/Stream-Alert/test-sync', { "encoding": "utf8"});
    return data
}

var token;



var newData = {
    "streamer_name": "Ninja",
    "streamer_id": "501581043",
    "is_live": false,
    "subscription_expiration_ms": 0,
    "email_list": [],
    "text_list": [],
    "email_account_list": [],
    "text_account_list": []
}




var subTime = 864000;
var mode = "subscribe"
var callback1 = "http://3.88.71.149:8000/webhook"

async function hook(id, lease, topic){
    return new Promise(function(resolve, reject) {
      let hub = [
        `hub.mode=${mode}`, // subscribe
        `hub.callback=${callback1}`, // this is the url where I receive the GET and POST from twitch
        `hub.lease_seconds=${lease}`, // 864000
        `hub.topic=${topic}` // stream online topic = https://api.twitch.tv/helix/streams?user_id=${id}
      ].join('&')

      request(({ method: 'POST', json: true, url: 'https://api.twitch.tv/helix/webhooks/hub?' + hub, headers: {'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': "Bearer " +returnToken()}}),
       (err, res, body) => {
        err && reject('webhooks failed')
        resolve(res.toJSON().statusCode === 202 ? 'webhook connected' : res.toJSON().statusCode + ' Error: ' + body.message)
      })
    })
}



app.get('/webhook', function(req, res){
    res.send(req.query['hub.challenge']);

    var topic = req.query['hub.topic'];
    topic = topic.replace("https://api.twitch.tv/helix/streams?user_id=", "")

    // add expiration date to db
    streamers.findOne({streamer_id:topic}, function(e, o) {
        if (o) {
            var d = new Date();
            var n = d.getTime();
            n = n + (subTime *1000)
            var newData = {
                "streamer_name": o.streamer_name,
                "streamer_id": o.streamer_id,
                "is_live": o.is_live,
                "subscription_expiration_ms": n,
                "email_list": o.email_list,
                "text_list": o.text_list,
                "email_account_list": o.email_account_list,
                "text_account_list": o.text_account_list
            }
            streamers.updateOne({streamer_id:topic}, {$set: newData}, function (x) {});
        } else {
            console.log("account not found: updating expiration date")
        }
    })

    // need detached script which runs daily, checks expiration dates, identifies and sends id to /resub
    // script: get expiration dates from database, decides which ones to resub, sends to /resub
    // this script must also run on startup 

})

var d = new Date();
var n = d.getTime();
var firstCheck = true
app.post('/webhook', function(req, res, next){
    res.sendStatus(202)
    if (req.body.data.length == 0) {
        // check which streams are offline
        // only allow once every 15 minutes
        var d2 = new Date();
        var n2 = d2.getTime();
        var shouldExecute = false;
        if (firstCheck) {
            firstCheck = false;
            shouldExecute = true;
            n = n2 + 900000
        } else {
            if (n2 > n) {
                shouldExecute = true;
                n = n2 + 900000
            }
        }
        if (shouldExecute) {
            // spawn child process and unref
            spawn('node', ['child.js'], {
                stdio: ['ignore', out, err], // piping all stdio to /dev/null
                detached: true
            }).unref();
        }

        
    } else {
        // check if stream is already registered as live
        // if !live send broadcast, update value
        streamers.findOne({streamer_id:req.body.data[0].user_id}, function(e, o) {
            if (o) {
                if (!o.is_live) {
                    var newData = {
                        "streamer_name": o.streamer_name,
                        "streamer_id": o.streamer_id,
                        "is_live": true,
                        "subscription_expiration_ms": o.subscription_expiration_ms,
                        "email_list": o.email_list,
                        "text_list": o.text_list,
                        "email_account_list": o.email_account_list,
                        "text_account_list": o.text_account_list
                    }
                    streamers.updateOne({streamer_id:req.body.data[0].user_id}, {$set: newData}, function (x) {});

                    // send request to broadcast to users (email/text)
                    var text = o.streamer_name + " just went live!"
                    for (x in o.text_list) {
                        var num1 = "+1"+o.text_list[x]
                        client2.messages.create({body: text, from: '+14158401437', to: num1}).then(message => console.log(message.sid));
                    }
                    
                }
            } else {
                console.log("account not found: when notification from Twitch was recieved")
            }
        })

    }
    console.log(new Date(Date.now()).toLocaleString())
})
function resubscription(id) {
    streamers.findOne({streamer_id:id}, function(e, o) {
        if (o) {
            hook("firstTry", subTime, `https://api.twitch.tv/helix/streams?user_id=${id}`)
        } else {
            console.log("account not found: when resubscription attempted")
        }
    })
}
app.post('/resub', function(req, res) {
    console.log("recieved resub id: " + req.body.id)
    resubscription(req.body.id)
})


app.post('/addStream', function(req, res) {
    // if live:
    //      update db
    //      send notification
    // hook()
    request(({ method: 'GET', json: true, url: 'https://api.twitch.tv/helix/streams?user_id=' + req.body.id, headers: {'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': "Bearer " +returnToken()}}),
       (err, res1, body) => {
           res.sendStatus(200)
           if (res1.body.data.length != 0) {
                streamers.findOne({streamer_id:req.body.id}, function(e, o) {
                    if (o) {
                        if (!o.is_live) {
                            var newData = {
                                "streamer_name": o.streamer_name,
                                "streamer_id": o.streamer_id,
                                "is_live": true,
                                "subscription_expiration_ms": o.subscription_expiration_ms,
                                "email_list": o.email_list,
                                "text_list": o.text_list,
                                "email_account_list": o.email_account_list,
                                "text_account_list": o.text_account_list
                            }
                            streamers.updateOne({streamer_id:req.body.id}, {$set: newData}, function (x) {});
        
                            // send request to broadcast to users (email/text)
                            var text = o.streamer_name + " just went live!"
                            for (x in o.text_list) {
                                var num1 = "+1"+o.text_list[x]
                                client2.messages.create({body: text, from: '+14158401437', to: num1}).then(message => console.log(message.sid));
                            }
                    
                        }
                    } else {
                        console.log("account not found: when adding stream")
                    }
                })
           }
           hook("firstTry", subTime, `https://api.twitch.tv/helix/streams?user_id=${req.body.id}`)
       })
})

app.post('/search', (req, res) => {
    request(({ method: 'GET', json: true, url: 'https://api.twitch.tv/helix/search/channels?query=' + req.body.query +"&first=5", headers: {'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': "Bearer " +returnToken()}}),
       (err, res1, body) => {
        res.send(body)
    })
})

app.post('/searchName', (req, res) => {
    request(({ method: 'GET', json: true, url: 'https://api.twitch.tv/helix/users?login=' + req.body.name, headers: {'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': "Bearer " +returnToken()}}),
       (err, res1, body) => {
        res.send(body)
    })
})

app.get('/', (req, res) => {
  res.send("");
});



app.post('/', (req, res) => {
    res.send("Is Up");
  });

// get all subscriptions from db, check active subscriptions from twitch, make sure no subscriptions are unmonitored
// 30 calls/ minute ==== 3000 streamers cap

var subscriptionIDs = []
function addIDToArray(topic) {
    if (topic.includes('https://api.twitch.tv/helix/streams?user_id=')) {
        var temp = topic.replace("https://api.twitch.tv/helix/streams?user_id=", "")
        subscriptionIDs.push(temp)
    }
}

function checkDB() {
    getAllRecords(function (e, o) {
        if (o) {
            var databaseIDs = []
            for (x in o) {
                databaseIDs.push(o[x].streamer_id)
            }
            for (i in subscriptionIDs) {
                var index = databaseIDs.indexOf(subscriptionIDs[i])
                if (index> -1) {
                    databaseIDs.splice(index, 1)
                }
            }

            for (x in databaseIDs) {
                //resub
                resubscription(databaseIDs[x])
            }
        }
    })
}

function recursivePagination(body) {
    request(({ method: 'GET', json: true, url: `https://api.twitch.tv/helix/webhooks/subscriptions?first=10&after=${body.pagination.cursor}`, headers: {'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': "Bearer " +returnToken()}}), (err, res3, body) => {
        if (Object.keys(res3.body.pagination).length === 0 && res3.body.pagination.constructor === Object) {
            // no pagination
            for(x in res3.body.data) {
                addIDToArray(res3.body.data[x].topic)
            }
            // after recursion finishes, check if all db entries have a subscription
            checkDB();
        } else {
            // pagination
            for(x in res3.body.data) {
                addIDToArray(res3.body.data[x].topic)
            }
            recursivePagination(res3.body)
        }
    })
}

request(({ method: 'POST', json: true, url: 'https://id.twitch.tv/oauth2/token?client_id='+process.env.TWITCH_CLIENT_ID+'&client_secret='+process.env.TWITCH_SECRET+'&grant_type=client_credentials', headers: {}}),
       (err, res1, body) => {
        token = res1.body.access_token;
        fs.writeFileSync('/home/bitnami/Stream-Alert/test-sync', token);
        request(({ method: 'GET', json: true, url: 'https://api.twitch.tv/helix/webhooks/subscriptions?first=100', headers: {'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': "Bearer " +returnToken()}}), (err, res2, body) => {
            if (Object.keys(res2.body.pagination).length === 0 && res2.body.pagination.constructor === Object) {
                
                for(x in res2.body.data) {
                    addIDToArray(res2.body.data[x].topic)
                }
            } else {
                
                for(x in res2.body.data) {
                    addIDToArray(res2.body.data[x].topic)
                }
                recursivePagination(res2.body)
            }
            returnToken()
        })
})



hook("firstTry", 864000, "https://api.twitch.tv/helix/streams?user_id=501581043")

// testing for POST /webhook when a stream ends
// params = []
// const subprocess = spawn('child.js', [], {
//     detached: true,
//     stdio: [ 'ignore', out, err ]
//   });
// subprocess.unref()


app.listen(8000, () => {
  console.log('Example app listening on port 8000!')
});