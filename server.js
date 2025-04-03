const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let games = {}; // Stores game rooms and players

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createGame', (callback) => {
    const gameCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    games[gameCode] = {
      host: socket.id,
      players: {},
    };

    socket.join(gameCode);
    games[gameCode].players[socket.id] = { id: socket.id, isImposter: false };

    io.to(gameCode).emit('playerListUpdate', games[gameCode].players);
    callback(gameCode);
  });

  socket.on('joinGame', (gameCode, callback) => {
    const game = games[gameCode];
    if (game) {
      socket.join(gameCode);
      game.players[socket.id] = { id: socket.id, isImposter: false };

      io.to(gameCode).emit('playerListUpdate', game.players);
      callback({ success: true });
    } else {
      callback({ success: false, message: "Game not found." });
    }
  });

  socket.on('startGame', (gameCode) => {
    const game = games[gameCode];
    if (game) {
      const playerIds = Object.keys(game.players);
      const imposterCount = 1;
      const imposters = [];

      while (imposters.length < imposterCount && imposters.length < playerIds.length) {
        const rand = playerIds[Math.floor(Math.random() * playerIds.length)];
        if (!imposters.includes(rand)) {
          imposters.push(rand);
          game.players[rand].isImposter = true;
        }
      }

      playerIds.forEach(id => {
        const role = game.players[id].isImposter ? 'imposter' : 'player';
        const question = role === 'imposter'
          ? "What's your favorite vegetable?"
          : "What's your favorite fruit?";
        io.to(id).emit('roleAssignment', { role, question });
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    for (const gameCode in games) {
      const game = games[gameCode];
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        io.to(gameCode).emit('playerListUpdate', game.players);

        // If the host leaves, remove the game
        if (socket.id === game.host) {
          delete games[gameCode];
          console.log(`Game ${gameCode} closed - host disconnected`);
        }
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
