async function handleSignUp(event) {
    event.preventDefault()
    body = {
        "user": $("#user").val(),
        "email": $("#email").val(),
        "pass": $("#password").val(),
        "phone": $("#phone").val()
    }
    const result = await axios({
        method: 'post',
        data: body,
        url: 'http://3.88.71.149:3000/signup'
    }).then(async () => {
        const result2 = await axios({
            method: 'post',
            data: body,
            url: 'http://3.88.71.149:3000/login'
        }).then(() => {
            window.location.href = 'http://3.88.71.149:3000/dashboard';
        })
       
        
    })
    
}


$(function() {
    $("#submit").on("click", handleSignUp)
})