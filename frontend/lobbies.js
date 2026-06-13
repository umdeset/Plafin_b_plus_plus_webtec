// Spiele-Map für die Bilder-Zuweisung innerhalb der Lobbies
const gameImages = {
    "Minecraft": "images/games/Minecraft.jpg",
    "Grand Theft Auto V": "images/games/GTA5.jpg",
    "Apex Legends": "images/games/APEX.jpeg.webp",
    "Counter Strike 2": "images/games/CS2.jpg",
    "Fortnite": "images/games/Fortnite.webp",
    "Rainbow 6 Siege": "images/games/Rainbow6.jpg",
    "League of Legends": "images/games/LOL.jpeg.webp",
    "World of Warcraft": "images/games/WOW.webp",
    "Valorant": "images/games/Valorant.jpg",
    "Ark Survival": "images/games/ARK.jpg",
    "Chess.com": "images/games/chess.webp",
    "Call of Duty: Black Ops 6": "images/games/COD_BO6.webp",
    "Roblox": "images/games/Roblox.jpg"
};

// Holt alle Lobbies vom Server und filtert sie im Frontend
async function loadLobbies() {
    const gameFilter = document.getElementById('gameFilter').value;

    // Holt den aktuell aktiven Mode (Casual oder Ranked)
    const activeModeBtn = document.querySelector('.toggle-btn.active');
    const modeFilter = activeModeBtn ? activeModeBtn.getAttribute('data-mode') : null;

    // Holt die aktuell ausgewählte Mic-Option (Required oder Optional)
    const activeMicRadio = document.querySelector('input[name="mic"]:checked');
    const micFilter = activeMicRadio ? activeMicRadio.value : null;

    const grid = document.getElementById('lobbyGrid');
    if (!grid) return;

    try {
        const response = await fetch('/groups');
        if (!response.ok) throw new Error("Fehler beim Laden der Gruppen");
        const groups = await response.json();

        let html = '';

        // filter logik
        const filteredGroups = groups.filter(group => {
            // Check Game
            if (gameFilter !== "ALL" && group.game !== gameFilter) return false;

            // Wir wandeln die Tags aus der DB in Kleinbuchstaben um um Fehler zu vermeiden
            const groupTags = group.tags ? group.tags.toLowerCase() : "";

            // Check Mode (Casual / Ranked)
            if (modeFilter && !groupTags.includes(modeFilter.toLowerCase())) return false;

            // Check Mic (Required / Optional)
            if (micFilter && !groupTags.includes(micFilter.toLowerCase())) return false;

            // Wenn die Lobby alle Checks bestanden hat  darf sie angezeigt werden
            return true;
        });

        if (filteredGroups.length === 0) {
            grid.innerHTML = `<p style="color: #8b8d96; grid-column: 1/-1; text-align: center;">No active lobbies found for this selection.</p>`;
            return;
        }

        filteredGroups.forEach(group => {
            const imgPath = gameImages[group.game] || 'images/default.jpg';
            const lobbyTitle = group.title || `${group.game} Lounge`;

            // Tags dynamisch generieren
            // Splittet den String "Casual, Optional" in ein Array und baut HTML-Spans
            let tagsHtml = '';
            if (group.tags) {
                const tagsArray = group.tags.split(',');
                tagsArray.forEach(tag => {
                    // .trim() entfernt überflüssige Leerzeichen
                    tagsHtml += `<span class="tag">${tag.trim()}</span>`;
                });
            }

            html += `
                <div class="lobby-card">
                    <div class="lobby-header">
                        <div class="lobby-creator">
                            <span class="icon icon-profile" style="width:16px; height:16px;"></span>
                            ${group.creator_username}
                        </div>
                        <div class="lobby-slots">
                            Slots<br><strong>${group.current_players}/${group.max_players} Players</strong>
                        </div>
                    </div>
                    <div class="lobby-body">
                        <img class="lobby-game-img" src="${imgPath}" alt="${group.game}">
                        <div class="lobby-details">
                            <h2>${lobbyTitle}</h2>
                            <p>${group.description}</p>
                        </div>
                    </div>
                    <div class="lobby-footer">
                        <div class="lobby-tags">
                            ${tagsHtml} 
                        </div>
                        <button class="btn-join">Join Lobby</button>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;

    } catch (err) {
        console.error("Lobby-Load Error:", err);
    }
}

window.onload = async () => {
    // URL-Parameter checken (?game=Minecraft)
    const urlParams = new URLSearchParams(window.location.search);
    const selectedGame = urlParams.get('game');
    const gameSelect = document.getElementById('gameFilter');

    // Wenn von einer Karte gekommen, Filter setzen, sonst bleibt es auf "ALL"
    if (selectedGame && gameSelect) {
        gameSelect.value = selectedGame;
    }

    // Lobbies initial rendern
    await loadLobbies();

    // Filter Event-Listener einrichten
    if (gameSelect) {
        gameSelect.addEventListener('change', loadLobbies);
    }

    // Toggle Button Logik (Casual/Ranked)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // Merken, ob der geklickte Button gerade aktiv war
            const wasActive = e.target.classList.contains('active');

            // Erstmal bei ALLEN Buttons das 'active' entfernen
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));

            // Nur wenn er vorher NICHT aktiv war, setzen wir ihn auf aktiv.
            // Sonst bleibt er aus und der Filter ist quasi gelöscht.
            if (!wasActive) {
                e.target.classList.add('active');
            }

            await loadLobbies(); // Liste direkt aktualisieren
        });
    });

    // Radio Button Logik (Mic)
    // Wir merken uns, welcher Radio-Button aktuell ausgewählt ist (beim Start ist es der mit "checked" im HTML)
    let lastCheckedMic = document.querySelector('input[name="mic"]:checked');

    document.querySelectorAll('input[name="mic"]').forEach(radio => {
        // Wir nutzen hier 'click' statt 'change', um auch Klicks auf bereits gewählte Radios zu bemerken
        radio.addEventListener('click', async (e) => {
            if (lastCheckedMic === e.target) {
                // Wenn genau der gleiche Radio-Button nochmal geklickt wurde wird er abgewählt
                e.target.checked = false;
                lastCheckedMic = null; // Kein Mic-Filter mehr aktiv
            } else {
                // Ein anderer Radio-Button wurde geklickt
                lastCheckedMic = e.target;
            }

            await loadLobbies(); // Liste direkt aktualisieren
        });
    });



    // create lobby logik
    const modal = document.getElementById('createModal');
    const btnOpenModal = document.querySelector('.btn-create-lobby'); // Dein Button im Header
    const btnCloseModal = document.getElementById('closeModal');

    // Öffnen & Schließen
    btnOpenModal.addEventListener('click', () => modal.style.display = 'flex');
    btnCloseModal.addEventListener('click', () => modal.style.display = 'none');

    // Wenn man außerhalb des fensters klickt schlißt es eif
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Player Counter Logic mit + und - erhöhen oder weniger machen
    const maxPlayersInput = document.getElementById('modalMaxPlayers');
    document.getElementById('btnMinus').addEventListener('click', () => {
        let val = parseInt(maxPlayersInput.value);
        if (val > 2) maxPlayersInput.value = val - 1;
    });

    document.getElementById('btnPlus').addEventListener('click', () => {
        let val = parseInt(maxPlayersInput.value);
        if (val < 64) maxPlayersInput.value = val + 1;
    });

    // Formular absenden abfangen
    document.getElementById('createLobbyForm').addEventListener('submit', async (e) => {
        e.preventDefault(); // Verhindert, dass die Seite neu lädt

        // Daten aus dem Formular auslesen
        const game = document.getElementById('modalGame').value;
        const mode = document.getElementById('modalMode').value;
        const title = document.getElementById('modalTitle').value;
        const desc = document.getElementById('modalDesc').value;
        const maxPlayers = document.getElementById('modalMaxPlayers').value;
        const mic = document.querySelector('input[name="modalMic"]:checked').value;
        const customTag = document.getElementById('modalCustomTags').value;

        // Tags zusammenbauen (z.B. "Casual, Optional, No Toxic")
        let tagsArray = [mode, mic];
        if (customTag.trim() !== '') tagsArray.push(customTag.trim());
        const finalTags = tagsArray.join(', ');

        const newLobbyData = {
            game: game,
            title: title,
            description: desc,
            max_players: parseInt(maxPlayers),
            tags: finalTags
        };

        try {
            // An das backend schicken mit POST method
            const response = await fetch('/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLobbyData)
            });

            if (response.ok) {
                // Wenn geklappt schissst fenster und ladet neu
                modal.style.display = 'none';
                document.getElementById('createLobbyForm').reset();
                await loadLobbies();
            } else {
                console.error("Fehler beim Erstellen der Lobby");
                alert("Could not create lobby. Please try again.");
            }
        } catch (err) {
            console.error(err);
        }
    });

};