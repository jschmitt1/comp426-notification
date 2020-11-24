const express = require('express')
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var request = require('request');
var path = require('path');
const fs = require('fs');
var cors = require('cors');
const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const MongoClient 	= require('mongodb').MongoClient;
var MongoStore = require('connect-mongo')(session);
var AM = require('./modules/account-manager.js');
var SM = require('./modules/streamers-manager.js');
const { doesNotMatch } = require('assert');
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);



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
        accounts = db.collection('accounts');
    // index fields 'user' & 'email' for faster new account validation //
        streamers.createIndex({streamer_id: 1, streamer_name: 1});
        accounts.createIndex({user: 1});
        console.log('mongo :: connected to database :: "'+"node-login"+'"');
	}
});






app.post('/streamerExist', function(req, res) {
    streamers.findOne({streamer_id:req.body['streamer_id']}, function(e, o) {
        if (o) {
            res.send(true)
        } else {
            res.send(false)
        }
    })
})


app.post('/newStreamer', function(req, res){
    if (req.session.user == null){
		res.redirect('/');
	} else {
        req.body['username'] = req.session.user.user
        req.body['phone_number'] = req.session.user.phone
        streamers.findOne({streamer_id:req.body['streamer_id']}, function(e, o) {
            if (o) {
                res.send("streamer already exists")
            } else {
                newdata = {
                    streamer_name: req.body['streamer_name'],
                    streamer_id: req.body['streamer_id'],
                    is_live: false,
                    text_list: [req.body['phone_number']],
                    subscription_expiration_ms: 0,
                    text_account_list: [req.body['username']]
                }
                SM.addNewAccount(newdata, function(error, o) {
                    if (error) {
                        console.log(error)
                    } else {
                        // update user account
                        accounts.findOne({user:req.body['username']}, function(e, o) {
                            if (o) {
                                o.streamersFollowed.push(req.body['streamer_id'])
                                accounts.findOneAndUpdate({user:req.body['username']}, {$set:o}, {returnOriginal : false}, function(e, o) {
                                    if (o) {
                                        body = {
                                            id: req.body['streamer_id']
                                        }
                                        request(({ method: 'POST', json: body, url: 'http://3.88.71.149:8000/addStream', headers: {}}), (err, res1, body) => {
                                            // send text
                                            var text = 'You are now following ' + req.body['streamer_name'] + ". You will be notified when they go live!"
                                            var num1 = "+1"+req.body['phone_number']
                                            client.messages.create({body: text, from: '+14158401437', to: num1}).then(message => console.log(message.sid));
                                            res.statusCode = 200
                                            res.send("added stream")
                                        })
                                    }
                                });
                            } else {
                                res.statusCode = 403
                                res.send("couldn't find user")
                            }
                        })
                        
                    }
                })
            }
        })
    }
        
    
    
            
        
    
});

app.post('/userFollowsStreamer', function(req, res){
    if (req.session.user == null){
		res.redirect('/');
	} else {
        req.body['username'] = req.session.user.user
        req.body['phone_number'] = req.session.user.phone
        streamers.findOne({streamer_id:req.body['streamer_id']}, function(e, o) {
            if (o){
                // streamer exists in mongodb already 
                if (!o.text_account_list.includes(req.body['username'])) {
                    o.text_account_list.push(req.body['username'])
                    o.text_list.push(req.body['phone_number'])
                    streamers.findOneAndUpdate({streamer_id:req.body['streamer_id']}, {$set:o}, {returnOriginal : false}, function() {
                        accounts.findOne({user:req.body['username']}, function(e, o1) {
                            if (o1) {
                                o1.streamersFollowed.push(req.body['streamer_id'])
                                accounts.findOneAndUpdate({user:req.body['username']}, {$set:o1}, {returnOriginal : false}, function() {
                                    // send startup text
                                    var text = 'You are now following ' + req.body['streamer_name'] + ". You will be notified when they go live!"
                                    var num1 = "+1"+req.body['phone_number']
                                    client.messages.create({body: text, from: '+14158401437', to: num1}).then(message => console.log(message.sid));
                                    if (o.is_live) {
                                        var text2 = req.body['streamer_name'] + " is currently live!"
                                        client.messages.create({body: text2, from: '+14158401437', to: num1}).then(message => console.log(message.sid));
                                    }
                                    res.statusCode = 200
                                    res.send("gottem")
                                });
                            } else {
                                res.send("couldn't find user")
                            }
                        })
                    });
                } else {
                    res.statusCode = 403
                    res.send("user already follows streamer")
                }
                
            }else {
                // console.log("in here")
                // body = req.body
                // request(({ method: 'POST', json: body, url: 'http://3.88.71.149:8000/newStreamer', headers: {}}), (err, res1, body) => {
                //     console.log("sent newStreamer request");
                //     console.log(body)
                //     res.send(body)
                // })
            }
        });
    }
    
});

app.post('/userUnFollowsStreamer', function(req, res){
    if (req.session.user == null){
		res.redirect('/');
	} else {
        req.body['username'] = req.session.user.user
        req.body['phone_number'] = req.session.user.phone
        accounts.findOne({user:req.body['username']}, function(e, o) {
            if (o) {
                streamers.findOne({streamer_id:req.body['streamer_id']}, function(e1, o1) {
                    if (o1){
                        o.streamersFollowed = o.streamersFollowed.filter(function(value, index, arr){ 
                            return value != req.body['streamer_id'];
                        });
                        accounts.findOneAndUpdate({user:req.body['username']}, {$set:o}, {returnOriginal : false}, function() {
                            o1.text_list = o1.text_list.filter(function(value, index, arr){ 
                                return value != req.body['phone_number'];
                            });
                            o1.text_account_list = o1.text_account_list.filter(function(value, index, arr){ 
                                return value != req.body['username'];
                            });
                            streamers.findOneAndUpdate({streamer_id:req.body['streamer_id']}, {$set:o1}, {returnOriginal : false}, function() {
                                res.statusCode = 200
                                res.send("gottem")
                            })
                        });
                    } else {
                        res.statusCode = 403
                        res.send("couldn't find streamer")
                    }
                })
            } else {
                res.statusCode = 403
                res.send("couldn't find user")
            }
        })
    }
    
});





//
//   ACCOUNT HANDLING
//


app.get('/login', function(req, res){
	// check if the user has an auto login key saved in a cookie //
		if (req.cookies.login == undefined){
			res.sendFile(path.join(__dirname, 'public/login/login.html'))
		}	else{
    // attempt automatic login //
			AM.validateLoginKey(req.cookies.login, req.ip, function(e, o){
				if (o){
					AM.autoLogin(o.user, o.pass, function(o){
                        req.session.user = o;
						res.redirect('http://3.88.71.149:3000/dashboard');
					});
				}	else{
					res.sendFile(path.join(__dirname, 'public/login/login.html'))
				}
			});
		}
});

app.post('/login', function(req, res){
    AM.manualLogin(req.body['user'], req.body['pass'], function(e, o){
        if (!o){
            res.status(400).send(e);
        }	else{
            req.session.user = o;
            if (req.body['remember-me'] == 'false'){
                res.status(200).send(o);
            }	else{
                AM.generateLoginKey(o.user, req.ip, function(key){
                    res.cookie('login', key, { maxAge: 900000 });
                    res.status(200).send(o);
                });
            }
        }
    });
});

app.post('/logout', function(req, res){
    res.clearCookie('login');
    req.session.destroy(function(e){ res.status(200).send('ok'); });
})
app.get('/logout', function(req, res){
    res.clearCookie('login');
    req.session.destroy(function(e){ res.redirect('/login'); });
    
})



app.post('/signup', function(req, res){
    AM.addNewAccount({
        email 	: req.body['email'],
        user 	: req.body['user'],
        pass	: req.body['pass'],
        phone   : req.body['phone'],
        streamersFollowed : []

    }, function(e){
        if (e){
            res.status(400).send("account creation error");
        } else {
            res.status(200).send('ok');
        }
    });
    
});

app.use(express.static(path.join(__dirname, 'public'), {index: '_'}));
// Add headers
app.use(cors({origin: '*'}));
app.post('/search', (req, res)=> {
    request(({ method: 'POST', json: {"query":req.body['query']}, url: 'http://3.88.71.149:8000/search?'}),
       (err, res1, body) => {
            res.send(res1)
       })
})

app.post('/searchName', (req, res)=> {
    request(({ method: 'POST', json: {"name":req.body['name']}, url: 'http://3.88.71.149:8000/searchName'}),
       (err, res1, body) => {
           if (err) {
               res.send(err)
           } else {
            res.send(body.data[0].id)
           }
       })
})

app.get('/getStreamers', (req, res) => {
    if (req.session.user == null){
		res.redirect('/');
	} else {
        accounts.findOne({user:req.session.user.user}, function(e, o) {
            if (o) {
                streamers2 = o.streamersFollowed
                var live = []
                var offline = []
                const promises1 = []
                var count = 0;
                function done1() {
                    res.send({
                        "live":live,
                        "offline": offline
                    })
                }
                streamers2.forEach(function(x) {
                    streamers.findOne({streamer_id:x}, function(e1, o1) {
                        if (o1){
                            if (o1.is_live) {
                                live.push(o1.streamer_name)
                            } else {
                                offline.push(o1.streamer_name)
                            }
                        }
                        if (++count == streamers2.length) done1();
                    })
                }) 
            }
        })
        
        
        
        
        
        
        
    }

});
app.get('/dashboard', (req, res) => {
    if (req.session.user == null){
		res.redirect('/');
	} else {
        res.sendFile(path.join(__dirname, 'public/index.html'))
    }

});

app.get('/', (req, res) => {
    res.redirect('/login')

});
// signup
app.get('/signup', function(req, res) {
    res.sendFile(path.join(__dirname, 'public/signup/index.html'))
});


app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
});