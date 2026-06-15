document.getElementById("resetPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    const response = await fetch("/reset-password", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            token,
            newPassword
        })
    });

    const data = await response.json();

    if (response.ok) {
        alert("Password reset successfully. You can now login.");
        window.location.href = "/";
    } else {
        alert(data.error || "Could not reset password.");
    }
});