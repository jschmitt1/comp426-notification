async function handleLogin(event) {
    event.preventDefault()
    body = {
        "user": $("#email").val(),
        "pass": $("#password").val()
    }
    const result = await axios({
        method: 'post',
        data: body,
        url: 'http://3.88.71.149:3000/login'
    })
    window.location.href = 'http://3.88.71.149:3000/dashboard';
}



$(function() {
    $("#submit").on("click", handleLogin)
})