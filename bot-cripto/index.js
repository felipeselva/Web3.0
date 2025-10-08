const axios = require('axios')
const SYMBOL = 'BTCUSDT' 
const BUY_PRICE = 121900
const SELL_PRICE = 122400

const API_URL = "https://testnet.binance.vision";//https://api.binance.com

let isOpened = false;
let operations = [];


function calcSMA(data){
    const closes = data.map(candle => parseFloat(candle[4]));
    const sum = closes.reduce((acc, val) => acc + val);
    return sum / data.length;
}

async function startTransition(){
    const {data} = await axios.get(API_URL + '/api/v3/klines?limit=21&interval=15m&symbol=' + SYMBOL);
    const candle = (data[data.length -1]);
    const price = parseFloat(candle[4]);

    console.clear();
    console.log(new Date().toLocaleTimeString(), '| Preço Atual:', price.toFixed(2))

    const sma13 = calcSMA(data.slice(8));
    console.log(`SMA 13: ${sma13.toFixed(2)}`);
    const sma21 = calcSMA(data);
    console.log(`SMA 21: ${sma21.toFixed(2)}`);
    console.log(`IsOpened? ${isOpened}`);


    //podendo trocar a logica de compra e venda exemplo price <= (sma * 0.999) ou price >= (sma * 1.001)
    if (sma13 > sma21 && isOpened === false) {
        console.log('Comprar BTCUSDT');
        isOpened = true;
        operations.push({ tipo: 'compra', preco: price, hora: new Date().toLocaleTimeString() });
    } else if (sma13 < sma21 && isOpened === true) {
        console.log('Vender BTCUSDT');
        isOpened = false;
        operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString() });
    } else {
        console.log('Aguardar');
    }
}

// MUDANÇA PRINCIPAL 1: Função de Resultado Parcial (não encerra o processo)
function mostrarResultadoParcial() {
    console.log('\n======================================================');
    console.log(`RELATÓRIO PARCIAL APÓS 6 HORAS: ${new Date().toLocaleString()}`);
    console.log('======================================================');
    
    let saldo = 0;
    let ultimaCompra = null;
    let percentualTotal = 0;
    let operacoesCompletas = 0;

    operations.forEach(op => {
        console.log(`${op.hora} - ${op.tipo.toUpperCase()} a ${op.preco.toFixed(2)}`);
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

    console.log(`\nLucro/Prejuízo NO PERÍODO: ${saldo.toFixed(2)} USD`);
    if (operacoesCompletas > 0) {
        console.log(`Percentual médio por operação: ${(percentualTotal / operacoesCompletas).toFixed(2)}%`);
    } else {
        console.log('Nenhuma operação completa realizada neste período.');
    }
    
    // CRUCIAL: Resetar o histórico para começar o cálculo do próximo ciclo de 6h
    operations = [];
    
    console.log('======================================================\n');
}


const checkInterval = setInterval(startTransition, 5000); // Executa a verificação a cada 5 segundos
startTransition(); // Executa imediatamente ao iniciar

// MUDANÇA PRINCIPAL 2: Novo temporizador para os resultados parciais (contínuo)
const reportInterval = setInterval(mostrarResultadoParcial, 6 * 60 * 60 * 1000); // Executa a cada 6 horas (sem parar o bot)

// O bloco setTimeout anterior foi REMOVIDO, garantindo que o bot rode sem limite de tempo.