// Connect to the correct server (local or Render)
const socket = io(window.location.origin);

// UI elements
const createBtn = document.getElementById('createGameBtn');
const joinBtn = document.getElementById('joinGameBtn');
const startBtn = document.getElementById('startGameBtn');
const backBtn = document.getElementById('backButton');

const gameCodeInput = document.getElementById('gameCodeInput');
const nameInput = document.getElementById('nameInput');
const gameInfo = document.getElementById('gameInfo');
const gameSection = document.getElementById('gameSection');
const questionDisplay = document.getElementById('questionDisplay');
const playerList = document.getElementById('playerList');
const menu = document.getElementById('menu');

let gameCode = '';
let isHost = false;

createBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter your name to create a game!");
    return;
  }

  socket.emit('createGame', name, (code) => {
    gameCode = code;
    isHost = true;
    showGameSection(`Game created! Code: ${code}`);
    startBtn.style.display = 'inline-block';
  });
});

joinBtn.addEventListener('click', () => {
  const code = gameCodeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();

  if (!code || !name) {
    alert("Please enter both your name and a game code!");
    return;
  }

  socket.emit('joinGame', { code, name }, (response) => {
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
  nameInput.value = '';
  gameCode = '';
  isHost = false;
});

// Receive your role and question
socket.on('roleAssignment', ({ role, question, name }) => {
  console.log('Received role assignment:', role, question, name);
  questionDisplay.textContent =
    `${name}, you are a ${role.toUpperCase()} 🤫\nYour question: ${question}`;
});

// Update player list for everyone
socket.on('playerListUpdate', (players) => {
  const list = Object.values(players).map(p => `🧍 ${p.name || p.id.slice(0, 5)}`);
  playerList.innerHTML = list.join('<br>');
});

// Utility function
function showGameSection(text) {
  menu.style.display = 'none';
  gameSection.style.display = 'block';
  gameInfo.textContent = text;
}