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

  // Create a new game
  socket.on('createGame', (name, callback) => {
    const code = generateGameCode();
    games[code] = {
      hostId: socket.id,
      players: {}, // name -> { id, name }
      currentRound: 1,
      currentQuestionPair: null,
      usedPairs: new Set(),
      assignments: {}, // name -> { role, question, playerQuestion, name }
      imposterName: null,
      questionRevealed: false
    };
    games[code].players[name] = { id: socket.id, name };
    socket.join(code);
    callback(code);
    io.to(code).emit('playerListUpdate', games[code].players);
  });

  // Join an existing game
  socket.on('joinGame', ({ code, name }, callback) => {
    const game = games[code];
    if (!game) return callback({ success: false, message: "Game not found." });
    if (game.players[name]) return callback({ success: false, message: "Name already taken." });

    game.players[name] = { id: socket.id, name };
    socket.join(code);
    callback({ success: true });
    io.to(code).emit('playerListUpdate', game.players);
  });

  // Start the game (first round)
  socket.on('startGame', (code) => {
    const game = games[code];
    if (!game) return;
    startNewRound(game, code);
  });

  // Move to the next round
  socket.on('nextRound', (code) => {
    const game = games[code];
    if (!game) return;
    game.currentRound++;
    startNewRound(game, code);
  });

  // Reveal imposter question
  socket.on('revealPlayerQuestion', (code) => {
    const game = games[code];
    if (game?.currentQuestionPair) {
      game.questionRevealed = true;
      console.log(`🔍 Revealing player question for game ${code}: ${game.currentQuestionPair.imposter}`);
      io.to(code).emit('playerQuestionRevealed', game.currentQuestionPair.imposter);
    }
  });

  // Rejoin a game
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
      isHost: game.hostId === socket.id
    });

    const assignment = game.assignments[name];
    if (assignment) {
      socket.emit('roleAssignment', assignment);
    }

    if (game.questionRevealed) {
      socket.emit('playerQuestionRevealed', game.currentQuestionPair.imposter);
    }

    io.to(code).emit('playerListUpdate', game.players);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Disconnected:', socket.id);
    // No cleanup to allow rejoining
  });

  socket.on('checkRevealStatus', (code) => {
    const game = games[code];
    if (game) {
      socket.emit('revealStatus', game.questionRevealed);
    }
  });
});

// Helper: start new round
function startNewRound(game, code) {
  const pair = getUnusedQuestionPair(game);
  if (!pair) {
    io.to(code).emit('noMoreQuestions');
    return;
  }

  game.currentQuestionPair = pair;
  game.questionRevealed = false;
  game.assignments = {};

  const playerNames = Object.keys(game.players);
  const imposterName = playerNames[Math.floor(Math.random() * playerNames.length)];
  game.imposterName = imposterName;

  playerNames.forEach(name => {
    const role = name === imposterName ? 'imposter' : 'innocent';
    const question = name === imposterName ? pair.imposter : pair.player;
    const player = game.players[name];

    game.assignments[name] = {
      role,
      question,
      playerQuestion: pair.imposter,
      name
    };

    io.to(player.id).emit('roleAssignment', game.assignments[name]);
  });

  io.to(code).emit('roundNumberUpdate', game.currentRound);
}

// Generate 4-letter game code
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Get unused question
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
