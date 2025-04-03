const socket = io(window.location.origin);

// UI Elements
const createBtn = document.getElementById('createGameBtn');
const joinBtn = document.getElementById('joinGameBtn');
const startBtn = document.getElementById('startGameBtn');
const backBtn = document.getElementById('backButton');
const revealBtn = document.getElementById('revealPlayerQuestionBtn');

const gameCodeInput = document.getElementById('gameCodeInput');
const nameInput = document.getElementById('nameInput');
const gameInfo = document.getElementById('gameInfo');
const gameSection = document.getElementById('gameSection');
const questionDisplay = document.getElementById('questionDisplay');
const playerQuestionReveal = document.getElementById('playerQuestionReveal');
const playerList = document.getElementById('playerList');
const menu = document.getElementById('menu');

let gameCode = '';
let isHost = false;

// Create game
createBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Enter your name to create a game!");
  socket.emit('createGame', name, (code) => {
    gameCode = code;
    isHost = true;
    showGameSection(`Game created! Code: ${code}`);
    startBtn.style.display = 'inline-block';
  });
});

// Join game
joinBtn.addEventListener('click', () => {
  const code = gameCodeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  if (!code || !name) return alert("Enter both a game code and your name.");
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

// Start game
startBtn.addEventListener('click', () => {
  if (isHost) socket.emit('startGame', gameCode);
});

// Receive role/question
socket.on('roleAssignment', ({ role, question, playerQuestion, name }) => {
  questionDisplay.innerHTML = `
    ${name}, here is your question:<br>
    <strong>${question}</strong>
  `;
  if (isHost) {
    revealBtn.style.display = 'inline-block';
  }
});

// Reveal player question
revealBtn.addEventListener('click', () => {
  revealBtn.style.display = 'none';
  socket.emit('revealPlayerQuestion', gameCode);
});

// Display revealed question to everyone
socket.on('playerQuestionRevealed', (question) => {
  playerQuestionReveal.style.display = 'block';
  playerQuestionReveal.innerHTML = `<strong>Player Question:</strong> ${question}`;
});

// Player list updates
socket.on('playerListUpdate', (players) => {
  const list = Object.values(players).map(p => `🧍 ${p.name || p.id.slice(0, 5)}`);
  playerList.innerHTML = list.join('<br>');
});

// Back to menu
backBtn.addEventListener('click', () => {
  menu.style.display = 'block';
  gameSection.style.display = 'none';
  startBtn.style.display = 'none';
  revealBtn.style.display = 'none';
  playerQuestionReveal.style.display = 'none';
  questionDisplay.textContent = '';
  playerQuestionReveal.textContent = '';
  playerList.innerHTML = '';
  nameInput.value = '';
  gameCodeInput.value = '';
  gameCode = '';
  isHost = false;
});

function showGameSection(text) {
  menu.style.display = 'none';
  gameSection.style.display = 'block';
  gameInfo.textContent = text;
}
