// Exemplo: Como criar um hash


const sha256 = require('crypto-js/sha256');
const transactions = { from: 'pessoa 1', to: 'pessoa 2', amount: 1 };
const str = JSON.stringify(transactions);
const hash = sha256(str);
console.log(hash.toString());