var express = require('express');
var app = express();
var path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.sendFile('home.html', {root: __dirname })
})

var server = app.listen(8081, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Example app listening at http://%s:%s", host, port)
})



$(function() {
    renderLiveNow();
    renderOffline();
});

export async function renderLiveNow() {
    const $root = $(`#root`);
}

export async function renderOffline() {
    const $root = $(`#root`);
}
