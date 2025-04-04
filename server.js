const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const wordList = require('./wordList');
const questionPairs = require('./questionPairs');

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let games = {}; // Stores all games by gameCode

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Host creates game
  socket.on('createGame', (name, callback) => {
    let gameCode;
    do {
      gameCode = wordList[Math.floor(Math.random() * wordList.length)];
    } while (games[gameCode]);

    games[gameCode] = {
      host: socket.id,
      players: {},
      currentQuestionPair: null,
      lastImposterId: null,
    };

    socket.join(gameCode);
    games[gameCode].players[socket.id] = {
      id: socket.id,
      name: name || `Host-${socket.id.slice(0, 5)}`,
      isImposter: false,
    };

    io.to(gameCode).emit('playerListUpdate', games[gameCode].players);
    callback(gameCode);
  });

  // Player joins game
  socket.on('joinGame', ({ code, name }, callback) => {
    const game = games[code];
    if (game) {
      socket.join(code);
      game.players[socket.id] = {
        id: socket.id,
        name: name || `Player-${socket.id.slice(0, 5)}`,
        isImposter: false,
      };
      io.to(code).emit('playerListUpdate', game.players);
      callback({ success: true });
    } else {
      callback({ success: false, message: "Game not found." });
    }
  });

  // Start first game (same logic as nextRound)
  socket.on('startGame', (gameCode) => {
    handleRoundStart(gameCode, socket.id);
  });

  // Start next round
  socket.on('nextRound', (gameCode) => {
    handleRoundStart(gameCode, socket.id);
  });

  // Host reveals player question
  socket.on('revealPlayerQuestion', (gameCode) => {
    const game = games[gameCode];
    if (game && game.currentQuestionPair) {
      io.to(gameCode).emit('playerQuestionRevealed', game.currentQuestionPair.player);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const code in games) {
      const game = games[code];
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        if (socket.id === game.host) {
          delete games[code];
          console.log(`❌ Game ${code} closed (host disconnected)`);
        } else {
          io.to(code).emit('playerListUpdate', game.players);
        }
        break;
      }
    }
  });
});

// 🔁 Handles both first and future rounds
function handleRoundStart(gameCode, starterSocketId) {
  const game = games[gameCode];
  if (!game || starterSocketId !== game.host) return;

  const playerIds = Object.keys(game.players);
  if (playerIds.length < 2) return;

  // 🔄 Reset roles
  Object.values(game.players).forEach(player => {
    player.isImposter = false;
  });

  // 🧠 Pick a new question pair
  const pair = questionPairs[Math.floor(Math.random() * questionPairs.length)];
  game.currentQuestionPair = pair;

  // 🎲 Pick new imposter (not same as last round)
  let imposterCandidates = [...playerIds];
  if (game.lastImposterId && playerIds.length > 1) {
    imposterCandidates = playerIds.filter(id => id !== game.lastImposterId);
  }

  const newImposterId = imposterCandidates[Math.floor(Math.random() * imposterCandidates.length)];
  game.players[newImposterId].isImposter = true;
  game.lastImposterId = newImposterId;

  // 🎯 Send role + question to each player
  playerIds.forEach(id => {
    const player = game.players[id];
    const role = player.isImposter ? 'imposter' : 'player';
    const question = role === 'imposter' ? pair.imposter : pair.player;

    io.to(id).emit('roleAssignment', {
      role,
      question,
      playerQuestion: pair.player,
      name: player.name,
    });

    console.log(`🔁 Round started: ${player.name} (${role}) — ${question}`);
  });
}

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});