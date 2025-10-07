// Exemplo: Testando Blockchain

const Block = require('../block');
const Blockchain = require('../blockChain');

const minhaBlockChain = new Blockchain();

minhaBlockChain.addBlock({from: 'pessoa 1', to: 'pessoa 2', amount: 1});
console.log(minhaBlockChain);