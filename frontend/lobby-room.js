let currentSession = null;
const socket = io(); // Verbindet sich mit dem Server
let roomId = null;

async function loadRoomData() {
    try {
        // Lobby Info holen
        const infoRes = await fetch(`/groups/${roomId}/info`);
        if (!infoRes.ok) throw new Error("Lobby existiert nicht");
        const roomInfo = await infoRes.json();

        document.getElementById('roomTitle').innerText = roomInfo.title || `${roomInfo.game} Lounge`;
        document.getElementById('roomPlayerCount').innerText = `${roomInfo.current_players}/${roomInfo.max_players}`;

        const updateBtn = document.getElementById('updateLobby');

        if(currentSession.username === roomInfo.creator_username) {
            updateBtn.style.display = 'block';

            document.getElementById('editMaxPlayers').value = roomInfo.max_players;
            document.getElementById('editDescription').value = roomInfo.description;
        } else {
            updateBtn.style.display = 'none';
        }

        // members holen
        const membersRes = await fetch(`/groups/${roomId}/members`);
        const members = await membersRes.json();

        const memberList = document.getElementById('memberList');
        memberList.innerHTML = '';
        members.forEach(member => {
            if(member.id === currentSession.id){
                memberList.innerHTML += `
                <li>
                    <span class="member-name">${member.username}</span>
                </li>`;
            }else {
                memberList.innerHTML += `
                <li>
                    <span class="member-name">${member.username}</span>
                    <button class="btn-kick">Kick</button>
                </li>`;
            }
        });

    } catch (err) {
        console.error(err);
        alert("Lobby existiert nicht mehr.");
        window.location.href = "/lobbies.html";
    }
}

window.onload = async () => {
    // Session check
    const sessionRes = await fetch('/session');
    if (!sessionRes.ok) { window.location.href = '/'; return; }
    currentSession = await sessionRes.json();
    // Raum ID aus der URL holen (?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('id');

    if (!roomId) {
        window.location.href = "/lobbies.html";
        return;
    }

    // Raumdaten laden und Socket beitreten
    await loadRoomData();
    socket.emit('joinRoom', roomId);

    socket.on('updatePlayerList', async () => {
        await loadRoomData();
    })

    const updateLobby = document.getElementById('updateLobby');

    // Chat Logik
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (msg) {
            socket.emit('chatMessage', {
                roomId: roomId,
                user: currentSession.username,
                text: msg
            });
            chatInput.value = '';
        }
    });

    let lastSender = null;
    let lastMessageDiv = null;

    // Nachricht empfangen
    socket.on('message', (data) => {
        const isSelf = data.user === currentSession.username;

        if (lastSender === data.user && lastMessageDiv) {
            // Wenn es der gleiche User ist, einfach als neue Zeile zur alten Blase hinzufügen
            lastMessageDiv.innerHTML += `<div>${data.text}</div>`;
        } else {

            // Wenn es ein neuer User ist, eine neue Blase erstellen
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${isSelf ? 'self' : ''}`;
            msgDiv.innerHTML = `<strong>${data.user}</strong><div>${data.text}</div>`;
            chatMessages.appendChild(msgDiv);

            lastSender = data.user;
            lastMessageDiv = msgDiv;

            }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Leave Lobby Logik
    document.getElementById('leaveLobbyBtn').addEventListener('click', async () => {
        try {
            const leaveRes = await fetch(`/groups/${roomId}/leave`, { method: 'DELETE' });
            if (leaveRes.ok) {
                window.location.href = "/lobbies.html";
            } else {
                alert("Fehler beim Verlassen der Lobby.");
            }
        } catch (err) {
            console.error(err);
        }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch("/logout");
            location.replace('/');
        });
    }

    const editModal = document.getElementById('editModal');
    const buttonCloseEdit = document.getElementById('closeEditModal');
    const updateLobbyButton = document.getElementById('updateLobby');

    //Öffnet und schließt
    updateLobbyButton.addEventListener('click', () => editModal.style.display = 'flex');
    buttonCloseEdit.addEventListener('click', () => editModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === editModal) editModal.style.display = 'none';
    });

    document.getElementById('editLobbyForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const newTitle = document.getElementById('editTitle').value;
        const newMaxPlayers = document.getElementById('editMaxPlayers').value;
        const newDescription = document.getElementById('editDescription').value;

        try{
            const response = await fetch(`/groups/${roomId}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    max_players: newMaxPlayers,
                    description: newDescription,
                    title: newTitle
                })
            });
            if (response.ok) {
                editModal.style.display = 'none';
                await loadRoomData();
                socket.emit('lobbiesChanged');
            } else {
                const errorData = await response.json();
                alert(errorData.error);
            }
        }catch(err) {
            console.error("Fehler beim Updaten der Lobby: ", err);
        }
    });
};