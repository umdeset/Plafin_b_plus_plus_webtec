let isFirstLoad = true;
// Holt alle Lobbies vom Server und filtert sie im Frontend
async function loadLobbies() {
    const gameFilter = document.getElementById('gameFilter');

    let currentSelectedGame = gameFilter.value

    if(isFirstLoad) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlGame = urlParams.get('game');
        if(urlGame) currentSelectedGame = urlGame;
        isFirstLoad = false;
    }

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
        if (!response.ok) throw new Error("Error loading lobbies");
        const groups = await response.json();

        //Dynamische Suche
        const uniqueGames = [...new Set(groups.map(g => g.game))];

        let dropdownMenu = '<option value="ALL">ALL GAMES</option>';

        uniqueGames.forEach(name => {
            dropdownMenu += `<option value="${name}">${name}</option>`;
        });

        gameFilter.innerHTML = dropdownMenu;

        if(currentSelectedGame === "ALL" || uniqueGames.includes(currentSelectedGame)) {
            gameFilter.value = currentSelectedGame;
        }else{
            gameFilter.value = "ALL";
            currentSelectedGame = "ALL";
        }

        let html = '';

        // filter logik
        const filteredGroups = groups.filter(group => {
            // Check Game
            if (currentSelectedGame !== "ALL" && group.game !== currentSelectedGame) return false;

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
            const imgPath = group.image_url;
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
                        <button class="btn-join" onclick="joinLobby(${group.id})">Join Lobby</button>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;

    } catch (err) {
        console.error("Lobby-Load Error:", err);
    }
}

async function joinLobby(groupId) {
    try{
        const response = await fetch(`/groups/${groupId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if(response.ok) {
            alert("You joined the group!") //später wird mit verlinkung auf lobby ersetzt
            await loadLobbies(groupId);
        } else {
            alert("Error: " + data.error);
        }
    }catch(err) {
        console.error("Lobby-Load Error:", err);
        alert("Unexpected Error occurred. Please try again.");
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

    const gameInput = document.getElementById('modalGameInput');
    const hiddenGameInput = document.getElementById('modalHiddenGameInput');
    const searchResults = document.getElementById('searchResults');
    let timer;

    gameInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        const query = e.target.value.trim();

        if(query.length < 3) {
            searchResults.style.display = 'none';
            return;
        }

        timer = setTimeout(async () => {
            try{
                const response = await fetch(`/games/search?q=${encodeURIComponent(query)}`);
                if(response.ok) {
                    const games = await response.json();
                    renderSearchResults(games);
                } else {
                    searchResults.innerHTML = '<div class="search-item" style="color: #ff6b6b;">Game Not Found</div>';
                    searchResults.style.display = 'block';
                }
            }catch(err) {
                console.error("Search Error:", err);
            }
        }, 500);
    });

    function renderSearchResults(games) {
        if(games.length === 0) {
            searchResults.innerHTML = '<div class="search-item">Game Not Found</div>';
        }else {
            let html = '';
            games.forEach(game => {
                html += `
                <div class="search-item" data-gamename="${game.name}">
                    <img src="${game.image_url}" alt="Game Cover">
                    ${game.name}
                </div>
                `;
            });
            searchResults.innerHTML = html;

            document.querySelectorAll('.search-item').forEach(searchResult => {
                if(!searchResult.dataset.gamename) return;
                searchResult.addEventListener('click', (e) => {
                    gameInput.value = searchResult.dataset.gamename;
                    hiddenGameInput.value = searchResult.dataset.gamename;
                    searchResults.style.display = 'none';
                });
            });
        }

        searchResults.style.display = 'block';

        document.addEventListener('click', (e) => {
            if(!gameInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    }



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
        const game = document.getElementById('modalHiddenGameInput').value;
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

};