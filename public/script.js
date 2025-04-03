const socket = io();

const createBtn = document.getElementById('createGameBtn');
const joinBtn = document.getElementById('joinGameBtn');
const startBtn = document.getElementById('startGameBtn');
const gameCodeInput = document.getElementById('gameCodeInput');
const gameInfo = document.getElementById('gameInfo');
const gameSection = document.getElementById('gameSection');
const questionDisplay = document.getElementById('questionDisplay');

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
      showGameSection(`Joined game: ${code}`);
    } else {
      alert(response.message || "Could not join game.");
    }
  });
});

startBtn.addEventListener('click', () => {
  socket.emit('startGame', gameCode);
});

const backBtn = document.getElementById('backButton');

backBtn.addEventListener('click', () => {
  gameSection.style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  startBtn.style.display = 'none';
  questionDisplay.textContent = '';
  gameCodeInput.value = '';
  gameInfo.textContent = '';
  gameCode = '';
  isHost = false;
});

socket.on('roleAssignment', ({ role, question }) => {
  questionDisplay.textContent = `You are a ${role.toUpperCase()} 🤫\nYour question: ${question}`;
  socket.on('playerListUpdate', (players) => {
    const list = Object.values(players).map(p => `🧍 Player: ${p.id.slice(0, 5)}`);
    document.getElementById('playerList').innerHTML = list.join('<br>');
  });  
});

function showGameSection(text) {
  document.getElementById('menu').style.display = 'none';
  gameSection.style.display = 'block';
  gameInfo.textContent = text;
}