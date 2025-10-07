const axios = require('axios')
const SYMBOL = 'BTCUSDT' 
const BUY_PRICE = 122500
const SELL_PRICE = 124400

const API_URL = "https://testnet.binance.vision";//https://api.binance.com

let isOpened = false;
let operations = [];

async function startTransition(){
    const {data} = await axios.get(API_URL + '/api/v3/klines?limit=21&interval=15m&symbol=' + SYMBOL);
    const candle = (data[data.length -1]);
    const price = parseFloat(candle[4]);

    console.clear();
    console.log(price)

    if (price <= BUY_PRICE && isOpened === false) {
        console.log('Comprar BTCUSDT');
        isOpened = true;
        operations.push({ tipo: 'compra', preco: price, hora: new Date().toLocaleTimeString() });
    } else if (price >= SELL_PRICE && isOpened === true) {
        console.log('Vender BTCUSDT');
        isOpened = false;
        operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString() });
    } else {
        console.log('Aguardar');
    }
}

// Função para mostrar o resultado final após 6 horas
function mostrarResultadoFinal() {
    console.log('\nResumo das operações:');
    let saldo = 0;
    let ultimaCompra = null;
    let percentualTotal = 0;
    let operacoesCompletas = 0;

    operations.forEach(op => {
        console.log(`${op.hora} - ${op.tipo.toUpperCase()} a ${op.preco}`);
        if (op.tipo === 'compra') {
            ultimaCompra = op.preco;
        } else if (op.tipo === 'venda' && ultimaCompra !== null) {
            const lucro = op.preco - ultimaCompra;
            saldo += lucro;
            const percentual = (lucro / ultimaCompra) * 100;
            percentualTotal += percentual;
            operacoesCompletas++;
            ultimaCompra = null;
        }
    });

    console.log(`\nLucro/Prejuízo em 6 horas: ${saldo}`);
    if (operacoesCompletas > 0) {
        console.log(`Percentual médio por operação: ${(percentualTotal / operacoesCompletas).toFixed(2)}%`);
    } else {
        console.log('Nenhuma operação completa realizada.');
    }
    process.exit();
}