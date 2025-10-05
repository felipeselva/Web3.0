/*  #########    Como criar um HASH


const sha256 = require ('crypto-js/sha256');



const transactions = {
    
    from: 'pessoa 1',
    to: 'pessoa 2',
    amount: 1 
};

const str = JSON.stringify(transactions);

const hash = sha256(str);

console.log(hash.toString());*/

//---------------------------------------------------------------------//

/* TESTANDO BLOCK

const block = require('./block');

const bloco1 = new block();
console.log(bloco1)*/
const Block = require('./block');

const Blockchain = require('./blockChain');
const minhaBlockChain = new Blockchain();

minhaBlockChain.addBlock({from: 'pessoa 1', to: 'pessoa 2', amount: 1});
console.log(minhaBlockChain);