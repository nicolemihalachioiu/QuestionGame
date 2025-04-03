// Connect to the server (supports both localhost and Render)
const socket = io(window.location.origin);

// UI Elements
const createBtn = document.getElementById('createGameBtn');
const joinBtn = document.getElementById('joinGameBtn');
const startBtn = document.getElementById('startGameBtn');
const backBtn = document.getElementById('backButton');

const gameCodeInput = document.getElementById('gameCodeInput');
const gameInfo = document.getElementById('gameInfo');
const gameSection = document.getElementById('gameSection');
const questionDisplay = document.getElementById('questionDisplay');
const playerList = document.getElementById('playerList');
const menu = document.getElementById('menu');

let gameCode = '';
let isHost = false;

createBtn.addEventListener('click', () => {
  socket.emit('createGame', (code) => {
    gameCode = code;
    isHost = true;
    showGameSection(`Game created! Code: ${code}`);
    startBtn.style.display = 'inline-block';
  });
});

joinBtn.addEventListener('click', () => {
  const code = gameCodeInput.value.trim().toUpperCase();
  if (!code) return alert("Enter a game code!");
  socket.emit('joinGame', code, (response) => {
    if (response.success) {
      gameCode = code;
      isHost = false;
      showGameSection(`Joined game: ${code}`);
    } else {
      alert(response.message || "Could not join game.");
    }
  });
});

startBtn.addEventListener('click', () => {
  if (!isHost) return;
  socket.emit('startGame', gameCode);
});

backBtn.addEventListener('click', () => {
  gameSection.style.display = 'none';
  menu.style.display = 'block';
  startBtn.style.display = 'none';
  questionDisplay.textContent = '';
  gameInfo.textContent = '';
  playerList.innerHTML = '';
  gameCodeInput.value = '';
  gameCode = '';
  isHost = false;
});

// 🔥 Listen for role assignment
socket.on('roleAssignment', ({ role, question }) => {
  console.log('Received role assignment:', role, question);
  questionDisplay.textContent = `You are a ${role.toUpperCase()} 🤫\nYour question: ${question}`;
});

// 🔥 Update the player list when people join/leave
socket.on('playerListUpdate', (players) => {
  const list = Object.values(players).map(p => `🧍 Player: ${p.id.slice(0, 5)}`);
  playerList.innerHTML = list.join('<br>');
});

// Utility
function showGameSection(text) {
  menu.style.display = 'none';
  gameSection.style.display = 'block';
  gameInfo.textContent = text;
}