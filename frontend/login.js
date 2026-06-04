//we only need current Session for local saved users
//this is because
let currentSession = null;

//-----------------------------------------------Discord Login Functions------------------------------------------------------------
const checkDiscordLogin = async () => {
    const url = new URLSearchParams(window.location.search);
    const code = url.get("code");
    if (code) {
        //clean to not show any data
        window.history.replaceState({}, document.title, "/");

        try{
            const response = await fetch("/auth/discord",{
                method: "POST",
                headers: {"Content-type": "application/json"},
                body: JSON.stringify({code})
            });

            if(response){
                //i used replace so that if we use the browser's integrated go back button we do not go back to the login screen
                location.replace("/dashboard")
                return true;
            }
        }catch(err){
            console.error("Failed to authenticate with Discord: " + err);
        }
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

    //Checks if logged in through discord and creates a session for him
    const hasDiscordLogin = await checkDiscordLogin();
    //stops if true, if false goes to next
    if (hasDiscordLogin) return;

    //if no login worked, shows login screen
    const noLoginWorked = document.getElementById('login');
    if (noLoginWorked) {
        noLoginWorked.style.display = 'block';
    }
}