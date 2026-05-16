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
    });

    const resultJson = await result.json()
    const { username, id } = resultJson;
    if(document.getElementById('info')) document.getElementById("info").innerText = `Logged in as: ${username} (id: ${id})`;
    return resultJson
}

//helper function to check Discord state
const checkDiscordLogin = async () => {
    const accessToken = window.localStorage.getItem("access_token");
    const tokenType = window.localStorage.getItem("token_type");
    const url = new URLSearchParams(window.location.search);
    const code = url.get("code");

    //when comes back from discord with code
    if (code && !accessToken) {
        //cleans the url
        window.history.replaceState({}, document.title, "/");
        const result = await getToken(code);
        if (result.token_type && result.access_token) {
            await getUser(result.token_type, result.access_token);
            location.href = "dashboard.html";
            return true; //login successfull
        }
    }

    //when discord token is already safed
    if (accessToken) {
        await getUser(tokenType, accessToken);
        location.href = "dashboard.html";
        return true;
    }

    return false; //if no discord login was found
}

//-----------------------------------------------Normal Session Functions------------------------------------------------------------
const checkNormalSession = async () => {
    try {
        const response = await fetch('/session');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data && Object.keys(data).length > 0) {
            currentSession = data;
            location.href = "dashboard.html";
            return true;
        }
        return false;
    }catch(err) {
        console.error("No session found: " + err);
        currentSession = null;
        return false;
    }
}

//-----------------------------------------------Onload/Initialization------------------------------------------------------------

window.onload = async () => {

    const loginForm = document.getElementById('loginForm');
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            //prevents browser default behaviour/reloading the page and lets the JS fetch /login code
            e.preventDefault();
            //The FormData interface provides a way to construct a set of key/value pairs representing form fields and their values, which can be sent using the fetch(), XMLHttpRequest.send() or navigator.sendBeacon() methods. (got it from mozilla.org)
            const formData = new FormData(e.target);
            //gets username and password from URL
            const data = Object.fromEntries(formData);

            //try and catch not fetch and then because of race conditions between normal and discord login
            try{
                //creates session
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data),
                });

                //if pw is wrong or there was an error
                if(!response.ok) throw new Error(`HTTP ${response.status}`);

                currentSession = await response.json();
                //if login was successful, redirect to dashboard
                location.href = "dashboard.html";
            }catch(err) {
                console.error('Failed to login: ' + err);
                alert("Failed to login! Check username and password.");
            }
        })
    }

    //Checks if logged in normaly
    const hasNormalSession = await checkNormalSession();
    //stops if true, if false checks next
    if (hasNormalSession) return;

    //Checks if logged in through discord
    const hasDiscordLogin = await checkDiscordLogin();
    //stops if true, if false goes to next
    if (hasDiscordLogin) return;

    //if no login worked, shows login screen
    const noLoginWorked = document.getElementById('login');
    if (noLoginWorked) {
        noLoginWorked.style.display = 'block';
    }
}