let currentSession = null;
window.onload = async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    //checks if user is logged in and shows a welcome message
    try{
        const response = await fetch('/session');
        if (!response.ok) {
            window.location.href='/';
            return;
        }
        const userData = await response.json();
        currentSession = userData;
        document.getElementById('info').innerText = "Welcome : " + userData.username + " !";
    }catch(err){
        console.error("Error getting session data: ", err);
        window.location.href='/';
    }

    if (logoutBtn) {
        //asynch because it needs to wait for the response
        logoutBtn.addEventListener('click', async () => {
            try{
                const response = await fetch("/logout");
                if(response.ok){
                    currentSession = null;
                    location.replace('/')
                }else{
                    console.error("Logout denied")
                }
            }catch(err){
                console.error("Logout Failed:  ", err);
            }
        });
    }
}