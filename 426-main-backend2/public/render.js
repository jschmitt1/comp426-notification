$(function() {
    $("#followed").on("click", handleFollow)
    loadData()
    //renderLiveNow();
    //renderOffline();
});

async function handleRemove(event) {
    let requestURL = 'http://3.88.71.149:3000/searchName';
    let body = {
        "name": event.currentTarget.id
    };
    const result = await axios({
        method: 'post',
        data: body,
        url: requestURL
    });
    let requestURL1 = 'http://3.88.71.149:3000/userUnFollowsStreamer';
    let body1 = {
        "streamer_id": String(result.data)
    };
    const result1 = await axios({
        method: 'post',
        data: body1,
        url: requestURL1
    });
    setTimeout(function(){
        // refresh
        window.location.reload(true); 
    }, 500);
}

async function loadData() {
    let requestURL = 'http://3.88.71.149:3000/getStreamers';
    let body = {
    };
    const result = await axios({
        method: 'get',
        data: body,
        url: requestURL
    });
    const $live = $("#live-list")
    const $offline = $("#offline-list")
    for (x in result.data.live) {
        $live.append(`<li id="live-item"><div>${result.data.live[x]}</div><div><button class="button is-danger removeButton" id="${result.data.live[x]}">Stop Following</button></div></li>`)
    }
    for (x in result.data.offline) {
        $offline.append(`<li id="offline-item"><div>${result.data.offline[x]}</div><div><button class="button is-danger removeButton" id="${result.data.offline[x]}">Stop Following</button></div></li>`)
        
    }
    $(".removeButton").on("click", handleRemove)
}

$( "#search-form" ).keyup(function(event){
    let searchTerm = event.target.value;
    autoCompleteName(searchTerm);
});

async function handleFollow(event) {
    event.preventDefault()
    var streamerName = $("#streamer-search-input").val()
    let requestURL = 'http://3.88.71.149:3000/searchName';
    let body = {
        "name": streamerName
    };
    const result = await axios({
        method: 'post',
        data: body,
        url: requestURL
    });

    let requestURL2 = 'http://3.88.71.149:3000/streamerExist';
    let body2 = {
        "streamer_id": String(result.data)
    };
    const result2 = await axios({
        method: 'post',
        data: body2,
        url: requestURL2
    });
    // is streamer already tracked
    if (result2.data) {
        let requestURL3 = 'http://3.88.71.149:3000/userFollowsStreamer';
        let body3 = {
            "streamer_id": String(result.data),
            "streamer_name": streamerName
        };
        const result3 = await axios({
            method: 'post',
            data: body3,
            url: requestURL3
        });
        if (result3.status == 200) {
            document.getElementById('streamer-search-input').value = ""
            document.getElementById('streamer-search-input').innerHTML = ""
            document.getElementById('streamer-search-input').innerText = ""
            var orig = document.getElementById('streamer-search-input').style.backgroundColor;
            document.getElementById('streamer-search-input').style.backgroundColor = 'LightGreen';
            setTimeout(function(){
                document.getElementById('streamer-search-input').style.backgroundColor = orig;
                // refresh
                window.location.reload(true); 
            }, 4000);
        }
    } else {
        let requestURL3 = 'http://3.88.71.149:3000/newStreamer';
        let body3 = {
            "streamer_id": String(result.data),
            "streamer_name": streamerName
        };
        const result3 = await axios({
            method: 'post',
            data: body3,
            url: requestURL3
        });
        if (result3.status == 200) {
            document.getElementById('streamer-search-input').value = ""
            document.getElementById('streamer-search-input').innerHTML = ""
            document.getElementById('streamer-search-input').innerText = ""
            var orig = document.getElementById('streamer-search-input').style.backgroundColor;
            document.getElementById('streamer-search-input').style.backgroundColor = 'LightGreen';
            setTimeout(function(){
                document.getElementById('streamer-search-input').style.backgroundColor = orig;
                // refresh
                window.location.reload(true); 
            }, 4000);
            
        }
        
    }
    

}

async function autoCompleteName(search) {
    let requestURL = 'http://3.88.71.149:3000/search';
    let body = {
        "query": search
    };
    const result = await axios({
        method: 'post',
        data: body,
        url: requestURL
    });
    //console.log(result);
    //console.log(result.data.body.data[0].display_name);

    $(`#suggestions`).empty();  //empty out any items that might be left from last keypress
    let nameList = result.data.body.data;
    let suggestList = ``;
    let len = (nameList.length > 5) ? 5 : nameList.length; //get at most 5 suggestions
    //console.log(len);
    for(let i = 0; i < len; i++){
        suggestList += `<option value="${nameList[i].display_name}">`;
    }
    $(`#suggestions`).append(suggestList);
}





