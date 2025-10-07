


// VALIDANDO A BLOCKCHAIN

const Block = require('./block');
const Blockchain = require('./blockChain');

const minhaBlockChain = new Blockchain();

minhaBlockChain.addBlock({from: 'pessoa 1', to: 'pessoa 2', amount: 1});
minhaBlockChain.addBlock({from: 'pessoa 2', to: 'pessoa 1', amount: 0.5});

console.log(JSON.stringify(minhaBlockChain));
console.log('Blockchain is valid: ' + minhaBlockChain.isValid());

// = Adulterando o valor do bloco 1
minhaBlockChain.blocks[1].data = {from: 'pessoa 1', to: 'pessoa 2', amount: 1000};

console.log(JSON.stringify(minhaBlockChain));
console.log('Blockchain is valid: ' + minhaBlockChain.isValid());