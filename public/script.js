const socket = io(window.location.origin);

// UI Elements
const createBtn = document.getElementById('createGameBtn');
const joinBtn = document.getElementById('joinGameBtn');
const startBtn = document.getElementById('startGameBtn');
const backBtn = document.getElementById('backButton');
const revealBtn = document.getElementById('revealPlayerQuestionBtn');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const roundDisplay = document.getElementById('roundDisplay');

const gameCodeInput = document.getElementById('gameCodeInput');
const nameInput = document.getElementById('nameInput');
const gameInfo = document.getElementById('gameInfo');
const gameSection = document.getElementById('gameSection');
const questionDisplay = document.getElementById('questionDisplay');
const playerQuestionReveal = document.getElementById('playerQuestionReveal');
const playerList = document.getElementById('playerList');
const menu = document.getElementById('menu');

let rejoining = false;
let gameCode = '';
let isHost = false;

window.addEventListener('load', () => {
  const savedName = localStorage.getItem('playerName');
  const savedCode = localStorage.getItem('gameCode');

  if (savedName && savedCode) {
    rejoining = true;

    // TEMPORARILY HIDE THE MENU while we wait to confirm rejoin
    menu.style.display = 'none';
    gameSection.style.display = 'none';
    gameInfo.textContent = `Rejoining game: ${savedCode}...`;

    socket.emit('rejoinGame', { code: savedCode, name: savedName });
  }
});

// Create game
createBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Enter your name to create a game!");

  socket.emit('createGame', name, (code) => {
    gameCode = code;
    isHost = true;

    localStorage.setItem('playerName', name);
    localStorage.setItem('gameCode', code);

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

      localStorage.setItem('playerName', name);
      localStorage.setItem('gameCode', code);

      showGameSection(`Joined game: ${code}`);
    } else {
      alert(response.message || "Could not join game.");
    }
  });
});

// Start first round
startBtn.addEventListener('click', () => {
  if (isHost) socket.emit('startGame', gameCode);
});

// Reveal player question
revealBtn.addEventListener('click', () => {
  revealBtn.style.display = 'none';
  socket.emit('revealPlayerQuestion', gameCode);
});

// Next round
nextRoundBtn.addEventListener('click', () => {
  socket.emit('nextRound', gameCode);
  nextRoundBtn.style.display = 'none';
  playerQuestionReveal.style.display = 'none';
  questionDisplay.innerHTML = '';
});

// Role/question received
socket.on('roleAssignment', ({ role, question, playerQuestion, name }) => {
  rejoining = false;
  gameSection.style.display = 'block';
  menu.style.display = 'none';
  gameInfo.textContent = `Rejoined game: ${localStorage.getItem('gameCode')}`;

  questionDisplay.innerHTML = `
    ${name}, here is your question:<br>
    <strong>${question}</strong>
  `;

  playerQuestionReveal.style.display = 'none';
  playerQuestionReveal.textContent = '';
  nextRoundBtn.style.display = 'none';

  if (isHost) {
    revealBtn.style.display = 'inline-block';
  }
});

// Round number
socket.on('roundNumberUpdate', (roundNum) => {
  if (isHost) {
    roundDisplay.style.display = 'block';
    roundDisplay.textContent = `Round: ${roundNum}`;
  }
});

// Question revealed to all
socket.on('playerQuestionRevealed', (question) => {
  playerQuestionReveal.style.display = 'block';
  playerQuestionReveal.innerHTML = `<strong>Player Question:</strong> ${question}`;
  if (isHost) {
    nextRoundBtn.style.display = 'inline-block';
  }
});

// No more questions left
socket.on('noMoreQuestions', () => {
  if (isHost) {
    alert("No more unused questions left! Game over 🎉");
    nextRoundBtn.style.display = 'none';
  }
});

// Player list update
socket.on('playerListUpdate', (players) => {
  const list = Object.values(players).map(p => `🧍 ${p.name || p.id.slice(0, 5)}`);
  playerList.innerHTML = list.join('<br>');
});

// Rejoin failed (optional)
socket.on('rejoinFailed', () => {
  rejoining = false;
  alert("Failed to rejoin the game. Please re-enter your name.");
  menu.style.display = 'block';
  gameSection.style.display = 'none';
});

// Back to menu
backBtn.addEventListener('click', () => {
  if (!rejoining) {
    menu.style.display = 'block';
    gameSection.style.display = 'none';
    startBtn.style.display = 'none';
    revealBtn.style.display = 'none';
    nextRoundBtn.style.display = 'none';
    playerQuestionReveal.style.display = 'none';
    questionDisplay.textContent = '';
    playerQuestionReveal.textContent = '';
    playerList.innerHTML = '';
    nameInput.value = '';
    gameCodeInput.value = '';
    gameCode = '';
    isHost = false;

    localStorage.removeItem('playerName');
    localStorage.removeItem('gameCode');
  }
});

// Show game screen
function showGameSection(text) {
  menu.style.display = 'none';
  gameSection.style.display = 'block';
  gameInfo.textContent = text;
}

socket.on('rejoinSuccess', ({ name, code, isHost: wasHost }) => {
  rejoining = false;
  gameCode = code;
  isHost = wasHost;
  gameSection.style.display = 'block';
  menu.style.display = 'none';
  gameInfo.textContent = `Rejoined game: ${code}`;

  if (isHost) {
    startBtn.style.display = 'inline-block';
  }
});
