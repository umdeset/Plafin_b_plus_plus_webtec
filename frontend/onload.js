const getToken = async (code) => {
    const result = await fetch('http://localhost:3000/getToken', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: {
            "Content-Type": "application/json",
        },
    })

    const resultJson = await result.json()
    window.localStorage.setItem("access_token", resultJson.access_token)
    window.localStorage.setItem("token_type", resultJson.token_type)
    return resultJson
}

const getUser = async (tokenType, accessToken) => {
    const result = await fetch('http://localhost:3000/p/getUser', {
        headers: {
            authorization: `${tokenType} ${accessToken}`,
        },
    })

    const resultJson = await result.json()
    const { username, id, coins } = resultJson;
    document.getElementById('coins').innerText = coins;
    document.getElementById('info').innerText = `Logged in as: ${username} (id: ${id})`;
    return resultJson
}

window.onload = async () => {
    const accessToken = window.localStorage.getItem("access_token")

    const tokenType = window.localStorage.getItem("token_type")

    const fragment = new URLSearchParams(window.location.search);
    const code = fragment.get('code')

    if (!code && !accessToken) {
        document.getElementById('login').style.display = `block`;
        return
    }

    if (code && !accessToken) {
        window.history.replaceState({}, document.title, "/");  // set url to "/"
        const result = await getToken(code)
        if (result.token_type && result.access_token) {
            window.localStorage.setItem("token_type", result.token_type)
            window.localStorage.setItem("access_token", result.access_token)
            getUser(result.token_type, result.access_token)
        }
    }
    if (accessToken) {
        getUser(tokenType, accessToken)
    }
}