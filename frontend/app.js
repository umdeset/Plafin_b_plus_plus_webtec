const testButton = document.getElementById('test-btn');
const resultText = document.getElementById('result-text');

testButton.addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:3000/api/status');
        const data = await response.json();
        resultText.textContent = data.message;
    } catch (error) {
        resultText.textContent = "Error: Could not connect to backend.";
        resultText.style.color = "red";
    }
})

