const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const wordList = require('./wordList');
const questionPairs = require('./questionPairs');

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let games = {}; // gameCode => { host, players, currentQuestionPair }

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

  // Host starts game
  socket.on('startGame', (gameCode) => {
    const game = games[gameCode];
    if (!game || socket.id !== game.host) return;
  
    const playerIds = Object.keys(game.players);
    const imposterCount = 1;
    const imposters = [];
  
    // 🔒 Only select question if it hasn't been set yet
    if (!game.currentQuestionPair) {
      const randomIndex = Math.floor(Math.random() * questionPairs.length);
      const pair = questionPairs[randomIndex];
      game.currentQuestionPair = pair;
      console.log("🔒 Question pair for this round:", pair);
    }
  
    const pair = game.currentQuestionPair;
  
    while (imposters.length < imposterCount && imposters.length < playerIds.length) {
      const rand = playerIds[Math.floor(Math.random() * playerIds.length)];
      if (!imposters.includes(rand)) {
        imposters.push(rand);
        game.players[rand].isImposter = true;
      }
    }
  
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
  
      console.log(`Sent to ${player.name} (${role}): ${question}`);
    });
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
          console.log(`Game ${code} closed (host disconnected)`);
        } else {
          io.to(code).emit('playerListUpdate', game.players);
        }
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});