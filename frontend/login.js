//we only need current Session for local saved users
//this is because
let currentSession = null;

//-----------------------------------------------Google Login Functions------------------------------------------------------------
const checkDiscordAndGoogleLogin = async (provider) => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (!code) return false;

        try {
            const response = await fetch(`/auth/${provider}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code })

            });

            //zuerst fehler status abfragen dann alert schicken und url reinigen
            if (response.status === 409){
                const errorData = await response.json();
                alert(errorData.error);
                window.history.replaceState({}, document.title, "/");
            }

            //falls anderer fehler aufgetaucht ist sofort fehler thrown
            if(!response.ok){
                throw new Error(`HTTP ${response.status}`);
            }

            window.history.replaceState({}, document.title, "/");
            location.replace("/dashboard");
            return true;

        } catch (err) {
            console.error(`Fehler bei der ${provider}-Authentifizierung:`, err);
        }
        return false;
    }

//-----------------------------------------------Normal Session Functions------------------------------------------------------------
const checkNormalSession = async () => {
    try {
        const response = await fetch('/session');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data && Object.keys(data).length > 0) {
            currentSession = data;
            location.replace("/dashboard");
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

    const loginContainer = document.getElementById("login-container");
    const registerContainer = document.getElementById("register-container");
    const registerButton = document.getElementById("registerBtn");
    const backToLoginBtn = document.getElementById("backToLoginBtn");
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    //switch to register
    if(registerButton) {
        registerButton.addEventListener("click" , () => {
            loginContainer.style.display = "none";
            registerContainer.style.display = "block";
        });
    }
    //switch to login
    if(backToLoginBtn) {
        backToLoginBtn.addEventListener("click" , () => {
            registerContainer.style.display = "none";
            loginContainer.style.display = "block";
        })
    }

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
                location.replace("/dashboard");
            }catch(err) {
                console.error('Failed to login: ' + err);
                alert("Failed to login! Check username and password.");
            }
        })
    }
    if(registerForm){
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);

            try{
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data),
                });

                if(!response.ok){
                    const errorData = await response.json();
                    throw new Error(errorData.error);
                }
                backToLoginBtn.click()
            }catch(err) {
                console.error('Failed to register: ' + err);
                alert(err);
            }
        })
    }

    //Checks if already logged in normaly
    //checks if session is already there
    //is used first in case the user logged in with discord and already has a session
    const hasSession = await checkNormalSession();
    //stops if true, if false checks next
    if (hasSession) return;


    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
        // versuchen discord, wenn das nicht geht versuchen wir google
        if (await checkDiscordAndGoogleLogin('discord')) return;
        if (await checkDiscordAndGoogleLogin('google')) return;
    }

    const noLoginWorked = document.getElementById('login');
    if (noLoginWorked) {
        noLoginWorked.style.display = 'block';
    }
}