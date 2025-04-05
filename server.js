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
      usedPairs: [],
      round: 0
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

  // Player rejoining game after disconnect
  socket.on('rejoinGame', ({ code, name }) => {
    const game = games[code];
    if (!game) return;

    const existingPlayer = Object.values(game.players).find(p => p.name === name);
    if (existingPlayer) {
      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      game.players[socket.id] = existingPlayer;
      delete game.players[oldId];

      socket.join(code);
      io.to(code).emit('playerListUpdate', game.players);

      const role = existingPlayer.isImposter ? 'imposter' : 'player';
      const question = role === 'imposter'
        ? game.currentQuestionPair?.imposter
        : game.currentQuestionPair?.player;

      if (game.currentQuestionPair && question) {
        socket.emit('roleAssignment', {
          role,
          question,
          playerQuestion: game.currentQuestionPair.player,
          name: existingPlayer.name,
        });

        if (socket.id === game.host) {
          socket.emit('roundNumberUpdate', game.round);
        }
      }
    }
  });

  // Start first game or next round
  socket.on('startGame', (gameCode) => {
    handleRoundStart(gameCode, socket.id);
  });

  socket.on('nextRound', (gameCode) => {
    handleRoundStart(gameCode, socket.id);
  });

  // Host reveals the player question
  socket.on('revealPlayerQuestion', (gameCode) => {
    const game = games[gameCode];
    if (game && game.currentQuestionPair) {
      io.to(gameCode).emit('playerQuestionRevealed', game.currentQuestionPair.player);
    }
  });

  // Handle player disconnect
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

// Handles both first and future rounds
function handleRoundStart(gameCode, starterSocketId) {
  const game = games[gameCode];
  if (!game || starterSocketId !== game.host) return;

  const playerIds = Object.keys(game.players);
  if (playerIds.length < 2) return;

  // Reset roles
  Object.values(game.players).forEach(player => {
    player.isImposter = false;
  });

  // Select unused question pair
  const availableIndexes = questionPairs
    .map((_, index) => index)
    .filter(i => !game.usedPairs.includes(i));

  if (availableIndexes.length === 0) {
    io.to(gameCode).emit('noMoreQuestions');
    return;
  }

  const randomIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
  game.usedPairs.push(randomIndex);
  const pair = questionPairs[randomIndex];
  game.currentQuestionPair = pair;
  game.round += 1;

  // Choose new imposter
  let imposterCandidates = [...playerIds];
  if (game.lastImposterId && playerIds.length > 1) {
    imposterCandidates = playerIds.filter(id => id !== game.lastImposterId);
  }

  const newImposterId = imposterCandidates[Math.floor(Math.random() * imposterCandidates.length)];
  game.players[newImposterId].isImposter = true;
  game.lastImposterId = newImposterId;

  // Notify host of round #
  io.to(game.host).emit('roundNumberUpdate', game.round);

  // Send role and question to each player
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

    console.log(`Round started: ${player.name} (${role}) — ${question}`);
  });
}

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});