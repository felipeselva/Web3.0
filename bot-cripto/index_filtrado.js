const axios = require('axios')
const fs = require('fs');
const SYMBOL = 'BTCUSDT' 
const BUY_PRICE = 121900 
const SELL_PRICE = 122400 

const API_URL = "https://testnet.binance.vision";

let isOpened = false;
let operations = [];


function calcSMA(data){
    const closes = data.map(candle => parseFloat(candle[4]));
    const sum = closes.reduce((acc, val) => acc + val);
    return sum / data.length;
}

// FUNÇÕES DE RELATÓRIO DE EMERGÊNCIA (MANTIDAS NO CONSOLE)
function mostrarResultadoImediato() {
    let saldo = 0;
    let ultimaCompra = null;
    let operacoesCompletas = 0;
    let percentualTotal = 0;

    operations.forEach(op => {
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

    console.log(`\nLucro/Prejuízo até a falha: ${saldo.toFixed(2)} USD`);
    console.log(`Posição aberta (isOpened): ${isOpened ? 'Sim' : 'Não'}`);
    console.log('======================================================\n');
}

// =================================================================
// FUNÇÃO PRINCIPAL (COM FILTRO SMA 50)
// =================================================================
async function startTransition(){
    try {
        // BUSCA 50 DADOS PARA CALCULAR A SMA 50
        const {data} = await axios.get(API_URL + '/api/v3/klines?limit=50&interval=15m&symbol=' + SYMBOL);
        
        const candle = (data[data.length -1]);
        const price = parseFloat(candle[4]);

        // CÁLCULO DAS TRÊS MÉDIAS MÓVEIS
        const sma13 = calcSMA(data.slice(37)); 
        const sma21 = calcSMA(data.slice(29)); 
        const sma50 = calcSMA(data);           
        
        console.clear();
        console.log(new Date().toLocaleTimeString(), '| Preço Atual:', price.toFixed(2))
        console.log(`SMA 13: ${sma13.toFixed(2)}`);
        console.log(`SMA 21: ${sma21.toFixed(2)}`);
        console.log(`SMA 50: ${sma50.toFixed(2)}`);
        console.log(`IsOpened? ${isOpened}`);


        // LÓGICA DE COMPRA COM FILTRO: SMA13 > SMA21 E PREÇO > SMA50
        if (sma13 > sma21 && price > sma50 && isOpened === false) {
            console.log('Comprar BTCUSDT (Sinal Filtrado)');
            isOpened = true;
            operations.push({ tipo: 'compra', preco: price, hora: new Date().toLocaleTimeString() });
            
        // LÓGICA DE VENDA COM FILTRO: SMA13 < SMA21 E PREÇO < SMA50
        } else if (sma13 < sma21 && price < sma50 && isOpened === true) {
            console.log('Vender BTCUSDT (Tendência Revertida)');
            isOpened = false;
            operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString() });
            
        } else {
            console.log('Aguardar (Filtrando)');
        }
        
    } catch (error) {
        console.clear();
        console.error(`\n======================================================`);
        console.error(`[⚠️ ERRO DE CONEXÃO ${new Date().toLocaleString()}]: Não foi possível buscar dados.`);
        console.error(`Motivo: ${error.message}`);
        console.error('O bot irá pausar esta verificação e tentar novamente em 5 segundos...');
        
        mostrarResultadoImediato(); 
    }
}

// =================================================================
// FUNÇÃO DE RELATÓRIO PERSISTENTE (Salva em ARQUIVO SEPARADO)
// =================================================================
function mostrarResultadoParcial() {
    let logContent = ''; 
    
    // ... (Lógica de contabilidade permanece a mesma) ...
    logContent += '\n' + '='.repeat(50) + '\n';
    logContent += `RELATÓRIO PARCIAL APÓS 3 HORAS: ${new Date().toLocaleString()}\n`;
    logContent += '='.repeat(50) + '\n';
    
    let saldo = 0;
    let ultimaCompra = null;
    let percentualTotal = 0;
    let operacoesCompletas = 0;

    operations.forEach(op => {
        const opLine = `${op.hora} - ${op.tipo.toUpperCase()} a ${op.preco.toFixed(2)}\n`;
        logContent += opLine; 
        
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

    logContent += `\nLucro/Prejuízo NO PERÍODO: ${saldo.toFixed(2)} USD\n`;
    if (operacoesCompletas > 0) {
        logContent += `Percentual médio por operação: ${(percentualTotal / operacoesCompletas).toFixed(2)}%\n`;
    } else {
        logContent += 'Nenhuma operação completa realizada neste período.\n';
    }
    logContent += '='.repeat(50) + '\n';
    
    operations = [];
    
    // ALTERAÇÃO CRUCIAL: Salva no arquivo SEPARADO 'relatorio_filtrado.log'
    try {
        fs.appendFileSync('relatorio_filtrado.log', logContent);
        
        console.log(`\n[INFO - ${new Date().toLocaleTimeString()}] Relatório de 3 horas (FILTRADO) salvo em 'relatorio_filtrado.log'.`);
        
    } catch (err) {
        console.error(`[ERRO FS] Não foi possível salvar o relatório: ${err}`);
    }
}


// ======================================================
// CHAMADAS DE INICIALIZAÇÃO DO BOT 
// ======================================================

const checkInterval = setInterval(startTransition, 5000); 
startTransition(); 

const reportInterval = setInterval(mostrarResultadoParcial, 3 * 60 * 60 * 1000);