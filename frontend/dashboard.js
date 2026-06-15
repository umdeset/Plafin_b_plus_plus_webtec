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
            </div>`;
        });
        // Klatscht den ganzen fertigen HTML-Code auf einmal ins Grid
        grid.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
};

window.onload = async () => {
    // Rendert sofort die Spiele, wenn die Seite lädt
    await renderGames();

    // Session prüfen
    try {
        const response = await fetch('/session');
        if (!response.ok) { window.location.href = '/'; return; }
        currentSession = await response.json();
        document.getElementById('info').innerText = "Welcome : " + currentSession.username + " !";
    } catch (err) {
        window.location.href = '/';
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch("/logout");
            location.replace('/');
        });
    }

    // --- Settings Modal Logik ---
    const settingsIcon = document.querySelector('.icon-settings');
    const settingsModal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeModalBtn');

    if (settingsIcon) settingsIcon.addEventListener('click', () => settingsModal.style.display = 'flex');
    if (closeBtn) closeBtn.addEventListener('click', () => settingsModal.style.display = 'none');

    // --- Ansichtswechsel ---
    document.getElementById('changePasswordViewBtn').addEventListener('click', () => {
        document.getElementById('settingsDefaultView').style.display = 'none';
        document.getElementById('settingsPasswordView').style.display = 'block';
    });

    document.getElementById('changeUsernameViewBtn').addEventListener('click', () => {
        document.getElementById('settingsDefaultView').style.display = 'none';
        document.getElementById('settingsUsernameView').style.display = 'block';
    });

    document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
        if (!confirm("there is no back, think twice.")) return;
        const response = await fetch('/deleteAccount', { method: 'DELETE' });
        if (response.ok) { location.replace('/'); } else { alert("error at delete."); }
    });

    document.getElementById('savePasswordBtn').addEventListener('click', async () => {
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) return alert("Not the same password amk!");

        const response = await fetch('/changePassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const result = await response.json();
        if (result.success) {
            alert("Passwort changed successfully!");
            document.getElementById('settingsPasswordView').style.display = 'none';
            document.getElementById('settingsDefaultView').style.display = 'block';
        } else {
            alert(result.error);
        }
    });

    const usernameSettingsSection = document.getElementById('usernameSettingsSection');
    const usernameChangeBtn = document.getElementById('changeUsernameViewBtn');
    const passwordSection = document.getElementById('passwordSettingsSection');
    const usernameSection = document.getElementById('usernameSettingsSection');
    const uploadSection = document.getElementById('uploadSection');

// auführen wenn die elemente auch wirklich existieren
    if (passwordSection && usernameSection) {
        if (currentSession && currentSession.loginMethod === 'local') {
            // Lokaler User: Alles anzeigen
            passwordSection.style.display = 'block';
            usernameSection.style.display = 'block';
            if(uploadSection) uploadSection.style.display = 'block';
        } else {
            // Google/Discord User: Alles ausblenden
            passwordSection.style.display = 'none';
            usernameSection.style.display = 'none';
            if(uploadSection) uploadSection.style.display = 'none';
        }
    }

// listener für speichern
    const saveUsernameBtn = document.getElementById('saveUsernameBtn');
    if (saveUsernameBtn) {
        saveUsernameBtn.addEventListener('click', async () => {
            const newUsername = document.getElementById('newUsernameInput').value;
            if (!newUsername) return alert("Gib einen Namen ein!");

            const response = await fetch('/changeUsername', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newUsername })
            });

            const data = await response.json();
            if (response.ok) {
                alert("Username changed successfully!");
                location.reload();
            } else {
                alert(data.error); //once a day fehler
            }
        });
    }
    // --- Profil-Modal Logik ---
    const profileIcon = document.querySelector('.user-profile');
    const profileModal = document.getElementById('profileModal');

    if (profileIcon && profileModal) {
        profileIcon.addEventListener('click', (e) => {
            e.stopPropagation();

            if (!currentSession) {
                alert("Session wird noch geladen, bitte kurz warten.");
                return;
            }
            const avatarImg = document.getElementById('profileAvatar');
            if (currentSession.avatar_url) {
                avatarImg.src = currentSession.avatar_url;
            } else {
                avatarImg.src = 'images/plafinDefault.png';
            }
            avatarImg.style.display = 'inline-block';
            document.getElementById('profileUsername').innerText = `Hello, ${currentSession.username}!`;
            const loginInfo = document.getElementById('profileLoginInfo');


            // Logik: Local zeigt Email, andere zeigen Provider
            if (currentSession.loginMethod === 'local') {
                loginInfo.innerText = `Email: ${currentSession.email || 'Nicht hinterlegt'}`;
            } else {
                const provider = currentSession.loginMethod ?
                    currentSession.loginMethod.charAt(0).toUpperCase() + currentSession.loginMethod.slice(1) : "Unbekannt";
                loginInfo.innerText = `Angemeldet via: ${provider}`;
            }
            profileModal.style.display = 'flex';
        });
    }

    try {
        const groupRes = await fetch('/user/current-group');
        if (groupRes.ok) {
            const groupData = await groupRes.json();
            const activeLobbyBtn = document.getElementById('activeLobbyBtn');
            if (groupData.groupId && activeLobbyBtn) {
                activeLobbyBtn.style.display = 'flex'; // Button sichtbar machen
                activeLobbyBtn.href = `/lobby-room.html?id=${groupData.groupId}`; // Link zur aktiven Lobby setzen
            }
        }
    } catch(err) {
        console.error("Fehler beim Laden der aktiven Lobby:", err);
    }

    const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
    const avatarInput = document.getElementById('avatarInput');

    if (uploadAvatarBtn) {
        uploadAvatarBtn.addEventListener('click', async () => {
            const file = avatarInput.files[0];
            if (!file) return alert("Wähle zuerst ein Bild aus!");

            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch('/upload-avatar', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                alert("Bild erfolgreich hochgeladen!");
                // Session lokal aktualisieren und UI refreshen
                currentSession.avatar_url = data.avatar_url;
                document.getElementById('profileAvatar').src = data.avatar_url;
            } else {
                alert(data.error);
            }
        });
    }
};