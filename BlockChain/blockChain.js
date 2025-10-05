
//A Classe Blockchain, como criar uma cadeia de blocos

const sha256 = require ('crypto-js/sha256');

const Block = require('./block');


module.exports = class BlockChain {

    constructor() {
        this.blocks = [new Block()];
        this.nextIndex = 1;
  }

    getLastHash() {

  return this.blocks[this.blocks.length -1].hash;
}

  addBlock(data) {
    const lastHash = this.getLastHash();
    const block = new Block(this.nextIndex, lastHash, data);
    this.blocks.push(block);

    this.nextIndex++;
}

isValid() {
  for (let i = this.blocks.length -1; i > 0; i--) {
    const currentBlock = this.blocks[i];
    const previousBlock = this.blocks[i -1];

    if(currentBlock.hash !== currentBlock.generateHash()
      || currentBlock.prevHash !== previousBlock.hash || currentBlock.index !== previousBlock.index + 1) {
      return false;
    }
  }
  return true;
}

  }

