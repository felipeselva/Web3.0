// Dependências
const bip32 = require('bip32');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');

// Definir a rede (Testnet)
const networks = bitcoin.networks.testnet;

// CORREÇÃO 1: Caminho de derivação (Derivation Path)
// Formato correto: m / purpose' / coin_type' / account' / change / index
// m: master (obrigatório começar com m)
// 49': BIP49 (SegWit compatível com endereços antigos)
// 1': Bitcoin Testnet
// 0': Conta 0
// 0: Change (0 externo, 1 interno)
// 0: Index (primeiro endereço)
const path = "m/49'/1'/0'/0/0"; 

// Gerar Mnemonic e Seed
let minemnemonic = bip39.generateMnemonic();
const seed = bip39.mnemonicToSeedSync(minemnemonic);

// Criar a raiz da carteira HD
const root = bip32.fromSeed(seed, networks);

// CORREÇÃO 2: Derivação direta
// Como já definimos o caminho completo na variável 'path', 
// usamos apenas o derivePath uma vez para chegar no nó final.
let node = root.derivePath(path);

// CORREÇÃO 3: Geração de Endereço BIP49 (SegWit Wrapper)
// Para um endereço que começa com '2' na testnet (P2SH-P2WPKH),
// precisamos envolver o p2wpkh dentro do p2sh.
let btcAddress = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
        pubkey: node.publicKey,
        network: networks
    }),
    network: networks
}).address;

console.log("Carteira criada com sucesso!");
console.log("Endereço BTC (Testnet): ", btcAddress);
console.log("Chave privada WIF: ", node.toWIF());
console.log("Seed (Mnemonic): ", minemnemonic);