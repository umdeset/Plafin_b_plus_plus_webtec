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
        grid.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
};

async function loadFriendModal() {
    const modalContent = document.getElementById('friendsModalContent');
    if (!modalContent) return;

    modalContent.innerHTML = `
        <div style="margin-bottom: 20px;">
            <input type="text" id="friendUsername" placeholder="Username" style="width: 70%; padding: 8px; color: black;">
            <button onclick="sendFriendRequest()">Add</button>
        </div>
        <hr>
        
        <h3>Your friends</h3>
        <div id="friendsList">Loading friends...</div>
        
        <h3 style="margin-top: 20px;">Sent requests</h3>
        <div id="requestsList">Loading requests...</div>
    `;

    try {
        const friendRes = await fetch('/friend/list');
        const friends = await friendRes.json();
        const friendsDiv = document.getElementById('friendsList');

        friendsDiv.innerHTML = friends.length > 0
            ? friends.map(f => `<div style="padding: 8px; border-bottom: 1px solid #444;">${f.username}</div>`).join('')
            : '<p>No friends, loser :(.</p>';
    } catch (err) {
        console.error("Error at loading friends:", err);
    }

    try {
        const reqRes = await fetch('/friend/requests');
        const requests = await reqRes.json();
        const reqDiv = document.getElementById('requestsList');

        if (requests.length === 0) {
            reqDiv.innerHTML = '<p>No pending requests.</p>';
        } else {
            reqDiv.innerHTML = requests.map(req => {
                const isReceiver = req.receiver_id === currentSession.id;

                // Buttons je nach Rolle
                const actions = isReceiver
                    ? `<div> 
                        <button onclick="respondToRequest(${req.id}, 'accept')">Accept</button> 
                        <button onclick="respondToRequest(${req.id}, 'decline')">Decline</button> 
                       </div>`
                    : `<div> 
                        <button onclick="respondToRequest(${req.id}, 'decline')">Cancel</button> 
                       </div>`;

                return `
                <div style="display:flex; justify-content:space-between; margin-bottom: 10px; padding: 10px; background: #3b3b46; border-radius: 5px;"> 
                    <span>${isReceiver ? req.sender_name : req.receiver_name}</span> 
                    ${actions} 
                </div>`;
            }).join('');
        }
    } catch (err) {
        console.error("Error at loading requests:", err);
    }
}

async function sendFriendRequest() {
    const username = document.getElementById('friendUsername').value;
    const response = await fetch('/friend/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUsername: username })
    });

    if (response.ok) {
        alert("Request sent!");
        loadFriendModal();
    } else {
        const data = await response.json();
        alert(data.error);
    }
}

async function respondToRequest(requestId, action) {
    const method = action === 'decline' ? 'DELETE' : 'POST';
    const url = action === 'decline' ? `/friend/request/${requestId}` : `/friend/accept/${requestId}`;

    try {
        const response = await fetch(url, { method: method });
        if (response.ok) {
            alert("Done!");
            loadFriendModal();
        } else {
            const data = await response.json();
            alert(data.error || "Error at action.");
        }
    } catch (err) {
        console.error(err);
    }
}


window.onload = async () => {
    // Rendert sofort die Spiele, wenn die Seite lädt
    await renderGames();

    // Session prüfen
    try {
        const response = await fetch('/session');
        if (!response.ok) { window.location.href = '/'; return; }
        currentSession = await response.json();
        document.getElementById('greeting').innerText = "Welcome : " + currentSession.username + " !";
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

    if (passwordSection && usernameSection) {
        if (currentSession && currentSession.loginMethod === 'local') {
            passwordSection.style.display = 'block';
            usernameSection.style.display = 'block';
            if(uploadSection) uploadSection.style.display = 'block';
        } else {
            passwordSection.style.display = 'none';
            usernameSection.style.display = 'none';
            if(uploadSection) uploadSection.style.display = 'none';
        }
    }

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
                alert(data.error);
            }
        });
    }
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
                activeLobbyBtn.href = `/lobby-room.html?id=${groupData.groupId}`;
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
                currentSession.avatar_url = data.avatar_url;
                document.getElementById('profileAvatar').src = data.avatar_url;
            } else {
                alert(data.error);
            }
        });
    }

    const fruendsIcon = document.getElementById('openFriendsModal');
    const friendsModal = document.getElementById('friendsModal');

    if (fruendsIcon && friendsModal) {
        fruendsIcon.addEventListener('click', (e) => {
            friendsModal.style.display = 'flex';
            loadFriendModal();
        })
    }
};