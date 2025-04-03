const startButton = document.getElementById('startButton');
const questionContainer = document.getElementById('questionContainer');
const questionText = document.getElementById('questionText');
const revealButton = document.getElementById('revealButton');

const normalQuestion = "What's your favorite fruit?";
const imposterQuestion = "What's your favorite vegetable?";

let isImposter = false;

startButton.addEventListener('click', () => {
  // Randomly assign imposter role
  isImposter = Math.random() < 0.25; // 25% chance
  questionContainer.style.display = 'block';
  startButton.style.display = 'none';
});

revealButton.addEventListener('click', () => {
  questionText.textContent = isImposter ? imposterQuestion : normalQuestion;
  revealButton.disabled = true;
});
