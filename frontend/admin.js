async function adminAction(action) {
    let input = "";
    if (action === 'ban-user') {
        input = prompt("Welchen User bannen?");
        if (!input) return;

        const res = await fetch('/admin/ban-user', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: input })
        });
        const data = await res.json();
        alert(data.message || data.error);
    }
    else if (action === 'delete-lobby') {
        input = prompt("Welche Group-ID löschen?");
        if (!input) return;

        const res = await fetch('/admin/delete-lobby', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupId: input })
        });
        const data = await res.json();
        alert(data.message || data.error);
    }
}