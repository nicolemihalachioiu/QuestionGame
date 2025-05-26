const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let games = {};

io.on('connection', (socket) => {
  console.log('🟢 Connected:', socket.id);

  socket.on('createGame', (name, callback) => {
    const code = generateGameCode();
    games[code] = {
      hostId: socket.id,
      players: {},
      currentRound: 1,
      currentQuestionPair: null,
      usedPairs: new Set(),
      assignments: {},
      imposterName: null,
      questionRevealed: false,
      gameStarted: false
    };
    games[code].players[name] = { id: socket.id, name };
    socket.join(code);
    callback(code);
    io.to(code).emit('playerListUpdate', games[code].players);
  });

  socket.on('joinGame', ({ code, name }, callback) => {
    const game = games[code];
    if (!game) return callback({ success: false, message: "Game not found." });
    if (game.players[name]) return callback({ success: false, message: "Name already taken." });

    game.players[name] = { id: socket.id, name };
    socket.join(code);
    callback({ success: true });
    io.to(code).emit('playerListUpdate', game.players);
  });

  socket.on('startGame', (code) => {
    const game = games[code];
    if (!game) return;
    game.gameStarted = true;
    startNewRound(game, code);
  });

  socket.on('nextRound', (code) => {
    const game = games[code];
    if (!game) return;
    game.currentRound++;
    startNewRound(game, code);
  });

  socket.on('revealPlayerQuestion', (code) => {
    const game = games[code];
    if (game?.currentQuestionPair?.player) {
      console.log('✅ Revealing PLAYER QUESTION:', game.currentQuestionPair.player);
      game.questionRevealed = true;
      io.to(code).emit('playerQuestionRevealed', game.currentQuestionPair.player);
    } else {
      console.warn('❌ No current question pair to reveal');
    }
  });

  socket.on('checkRevealStatus', (code) => {
    const game = games[code];
    if (game) {
      socket.emit('revealStatus', game.questionRevealed);
    }
  });

  socket.on('rejoinGame', ({ code, name }) => {
    const game = games[code];
    if (!game || !game.players[name]) {
      socket.emit('rejoinFailed');
      return;
    }

    const wasHost = game.players[name].id === game.hostId;
    game.players[name].id = socket.id;
    socket.join(code);

    if (wasHost) {
      game.hostId = socket.id;
    }

    socket.emit('rejoinSuccess', {
      name,
      code,
      isHost: game.hostId === socket.id,
      gameStarted: game.gameStarted
    });

    const assignment = game.assignments[name];
    if (assignment) {
      socket.emit('roleAssignment', assignment);
    }

    if (game.questionRevealed) {
      socket.emit('playerQuestionRevealed', game.currentQuestionPair.player);
    }

    io.to(code).emit('playerListUpdate', game.players);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Disconnected:', socket.id);
  });
});

// =====================
// Helpers
// =====================

function startNewRound(game, code) {
  const pair = getUnusedQuestionPair(game);
  if (!pair) {
    io.to(code).emit('noMoreQuestions');
    return;
  }

  // ✅ Store correct pair
  game.currentQuestionPair = {
    player: pair.player,
    imposter: pair.imposter
  };

  game.questionRevealed = false;
  game.assignments = {};

  const playerNames = Object.keys(game.players);
  const imposterName = playerNames[Math.floor(Math.random() * playerNames.length)];
  game.imposterName = imposterName;

  playerNames.forEach(name => {
    const isImposter = name === imposterName;
    const assignedQuestion = isImposter ? pair.imposter : pair.player;
    const role = isImposter ? 'imposter' : 'innocent';

    const player = game.players[name];
    game.assignments[name] = {
      role,
      question: assignedQuestion,
      playerQuestion: pair.player, // ✅ This is the real question
      name
    };

    io.to(player.id).emit('roleAssignment', game.assignments[name]);
  });

  io.to(code).emit('roundNumberUpdate', game.currentRound);
}

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getUnusedQuestionPair(game) {
  const allPairs = require('./questionPairs');
  const unused = allPairs.filter(pair =>
    !game.usedPairs.has(`${pair.player}|${pair.imposter}`)
  );
  if (unused.length === 0) return null;
  const selected = unused[Math.floor(Math.random() * unused.length)];
  game.usedPairs.add(`${selected.player}|${selected.imposter}`);
  return selected;
}

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
