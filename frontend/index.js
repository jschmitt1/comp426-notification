
/*var express = require('express');
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
*/



$(function() {
    renderLiveNow();
    renderOffline();
});

$( "#search-form" ).keyup(function(event){
    let searchTerm = event.target.value;
    autoCompleteName(searchTerm);
});



export async function autoCompleteName(search) {
    let requestURL = 'http://3.88.71.149:3000/search';
    let body = {
        "query": search
    };
    const result = await axios({
        method: 'post',
        data: body,
        url: requestURL
    });

    $(`#suggestions`).empty();  //empty out any items that might be left from last keypress
    let nameList = result.data.body.data;
    let suggestList = ``;
    let len = (nameList.length > 5) ? 5 : nameList.length; //get at most 5 suggestions
    for(let i = 0; i < len; i++){
        suggestList += `<option value="${nameList[i].display_name}">`;
    }
    $(`#suggestions`).append(suggestList);
}



export async function renderLiveNow() {
    console.log("rendering Live Results");
    let requestURL = 'http://3.88.71.149:3000/getStreamers';
    const result = await axios({
        method: 'get',
        url: requestURL
    }); 
    //console.log(result);

    let liveStreamers = ``;
    for(let i = 0; i < result.live.length; i++){
        let name = results.live[i];
        //let name = "jabroniTony"; //debug
        liveStreamers += `<li id="live-item"><div>${name}</div><div><button class="button is-danger" id="stop-follow">Stop Following</button></div></li>`;
    }
    
    $("#live-list").append(liveStreamers);
}

export async function renderOffline() {
    //console.log("rendering Offline Results");
    let requestURL = 'http://3.88.71.149:3000/getStreamers';
    const result = await axios({
        method: 'get',
        url: requestURL
    });

    let liveStreamers = ``;
    for(let i = 0; i < result.offline.length; i++){
        let name = results.offline[i];
        //let name = "jabroniTony"; //debug
        liveStreamers += `<li id="offline-item"><div>${name}</div><div><button class="button is-danger" id="stop-follow">Stop Following</button></div></li>`;
    }
    
    $("#offline-list").append(liveStreamers);
}
