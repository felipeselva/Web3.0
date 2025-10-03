const sha256 = require ('crypto-js/sha256');

// Classe Block, como criar um bloco 


module.exports = class Block {
    constructor(index = 0, previousHash = null, data = 'Genesis Block'){
        this.index = index;
        this.data = data;
        this.timestamp = new Date();
        this.prevHash = previousHash;

        this.hash = this.generateHash();
    }

    generateHash() {
        return sha256(this.index + this.previousHash  +
             JSON.stringify(this.data) + this.timestamp).toString(); }




}