const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const wordList = require('./wordList'); // custom word-based game codes
const questionPairs = require('./questionPairs');

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let games = {}; // Tracks all active games

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Create a new game
  socket.on('createGame', (name, callback) => {
    let gameCode;
    do {
      gameCode = wordList[Math.floor(Math.random() * wordList.length)];
    } while (games[gameCode]); // avoid duplicate codes
  
    games[gameCode] = {
      host: socket.id,
      players: {},
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

  // Join an existing game
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

  // Start the game and assign roles
  socket.on('startGame', (gameCode) => {
    const game = games[gameCode];
    if (game && socket.id === game.host) {
      const playerIds = Object.keys(game.players);
      const imposterCount = 1;
      const imposters = [];

      // Randomly choose imposters
      while (imposters.length < imposterCount && imposters.length < playerIds.length) {
        const rand = playerIds[Math.floor(Math.random() * playerIds.length)];
        if (!imposters.includes(rand)) {
          imposters.push(rand);
          game.players[rand].isImposter = true;
        }
      }

      // Send role and question to each player
      playerIds.forEach(id => {
        const player = game.players[id];
        const role = player.isImposter ? 'imposter' : 'player';
        // Pick a random question pair for the round
        const pair = questionPairs[Math.floor(Math.random() * questionPairs.length)];
        const question = role === 'imposter' ? pair.imposter : pair.player;

        io.to(id).emit('roleAssignment', {
          role,
          question,
          name: player.name
        });
        console.log(`Sent role to ${player.name} (${id}): ${role}`);
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const gameCode in games) {
      const game = games[gameCode];
      if (game.players[socket.id]) {
        delete game.players[socket.id];

        // If host leaves, remove the whole game
        if (socket.id === game.host) {
          delete games[gameCode];
          console.log(`Game ${gameCode} closed (host left)`);
        } else {
          io.to(gameCode).emit('playerListUpdate', game.players);
        }
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});