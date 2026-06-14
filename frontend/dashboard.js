let currentSession = null;


// Diese Funktion rendert die Spiele-Karten dynamisch ins HTML
const renderGames = async ()  => {
    const grid = document.getElementById('gameGrid');
    if (!grid) return;   // Bricht ab, falls wir nicht auf dem Dashboard sind

    try{
        const response = await fetch('/games/load');

        if(!response.ok){
            const errorData = await response.json();
            throw new Error(errorData.error);
        }

        const gameData = await response.json();

        let html = '';
        // Geht jedes Spiel im Array durch und baut den passenden HTML-Block dafür zusammen
        gameData.forEach(g => {
            html += `
            <div class="game-card" onclick="window.location.href='/lobbies.html?game=${encodeURIComponent(g.game)}'">
                <img src="${g.image_url}" alt="${g.game}">
                <div class="game-info">
                    <h3>${g.game}</h3>
                    <div class="stats">
                        <p><span class="dot"></span>${g.players_online} Players Online</p>
                        <p><span class="dot"></span>${g.active_lobbies} Active Lobbies</p>
                    </div>
                </div>
            </div>
        `;
        });
        // Klatscht den ganzen fertigen HTML-Code auf einmal ins Grid
        grid.innerHTML = html;
    }catch (err){
        console.error(err);
    }
}



window.onload = async () => {
    // Rendert sofort die Spiele, wenn die Seite lädt
    await renderGames();

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