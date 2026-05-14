let currentSession = null;

//-----------------------------------------------Discord Login Functions------------------------------------------------------------
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
    const result = await fetch('http://localhost:3000/p/getDiscordUser', {
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

//-----------------------------------------------Discord Login Functions------------------------------------------------------------

window.onload = async () => {
    // Check session
    fetch("/session")
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            currentSession = data || null;
        })
        .catch(error => {
            console.error('Failed to load session:', error);
            currentSession = null;
        });
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
            location.href = "dashboard.html"
        }
    }
    if (accessToken) {
        getUser(tokenType, accessToken)
        location.href = "dashboard.html" //?token=" + accessToken
    }

    // Login dialog
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Task 1.1: Implement the login submit flow to call `POST /login`
        // with username and password, handle errors, save the response
        // into `currentSession`, then call `updateUI()` and `loadMovies()`.

        //Objects.fromEntries() transforms a list of key-value pairs into an Object
        const data = Object.fromEntries(formData);
        fetch(`/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
            .then(response => {
                if(!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                currentSession = data;
            })
            .catch(error => {
                console.error('Failed to load login:', error);
            })


    });

}