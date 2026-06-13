let currentSession = null;

const games = [
    { name: "Minecraft", img: "images/games/Minecraft.jpg", players: "4,867", lobbies: 158 },
    { name: "Grand Theft Auto V", img: "images/games/GTA5.jpg", players: "4,867", lobbies: 158 },
    { name: "Apex Legends", img: "images/games/APEX.jpeg.webp", players: "4,867", lobbies: 158 },
    { name: "Counter Strike 2", img: "images/games/CS2.jpg", players: "4,867", lobbies: 158 },
    { name: "Fortnite", img: "images/games/Fortnite.webp", players: "4,867", lobbies: 158 },
    { name: "Rainbow 6 Siege", img: "images/games/Rainbow6.jpg", players: "4,867", lobbies: 158 },
    { name: "League of Legends", img: "images/games/LOL.jpeg.webp", players: "4,867", lobbies: 158 },
    { name: "World of Warcraft", img: "images/games/WOW.webp", players: "4,867", lobbies: 158 },
    { name: "Valorant", img: "images/games/Valorant.jpg", players: "4,867", lobbies: 158 },
    { name: "Ark Survival", img: "images/games/ARK.jpg", players: "4,867", lobbies: 158 },
    { name: "Chess.com", img: "images/games/chess.webp", players: "4,867", lobbies: 158 },
    { name: "World of WarcraftCall of Duty: Black Ops 6", img: "images/games/COD_BO6.webp", players: "4,867", lobbies: 158 },
    { name: "Roblox", img: "images/games/Roblox.jpg", players: "4,867", lobbies: 158 }
];

// Diese Funktion rendert die Spiele-Karten dynamisch ins HTML
function renderGames() {
    const grid = document.getElementById('gameGrid');
    if (!grid) return;   // Bricht ab, falls wir nicht auf dem Dashboard sind

    let html = '';
    // Geht jedes Spiel im Array durch und baut den passenden HTML-Block dafür zusammen
    games.forEach(game => {
        html += `
            <div class="game-card" onclick="window.location.href='/lobbies.html?game=${encodeURIComponent(game.name)}'">
                <img src="${game.img}" alt="${game.name}">
                <div class="game-info">
                    <h3>${game.name}</h3>
                    <div class="stats">
                        <p><span class="dot"></span>${game.players} Players Online</p>
                        <p><span class="dot"></span>${game.lobbies} Active Lobbies</p>
                    </div>
                </div>
            </div>
        `;
    });
    // Klatscht den ganzen fertigen HTML-Code auf einmal ins Grid
    grid.innerHTML = html;
}



window.onload = async () => {
    // Rendert sofort die Spiele, wenn die Seite lädt
    renderGames();

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