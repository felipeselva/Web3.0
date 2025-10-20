const axios = require('axios');
const fs = require('fs');

// =================================================================
// CONFIGURAÇÕES DO BOT
// =================================================================
const SYMBOL = 'BTCUSDT';
const API_URL = "https://testnet.binance.vision";

// <<< NOVO >>> METAS DE TAKE PROFIT E STOP LOSS
const TP_PERCENTAGE = 0.007; // Take Profit de 0.7%
const SL_PERCENTAGE = 0.005; // Stop Loss de 0.5%

// =================================================================
// VARIÁVEIS DE ESTADO
// =================================================================
let isOpened = false;
let longPosition = null; // Objeto para guardar detalhes da posição
let operations = [];


function calcSMA(data) {
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
// FUNÇÃO PRINCIPAL (COM TP E SL)
// =================================================================
async function startTransition() {
    try {
        const {
            data
        } = await axios.get(API_URL + '/api/v3/klines?limit=50&interval=15m&symbol=' + SYMBOL);
        const candle = data[data.length - 1];
        const price = parseFloat(candle[4]);

        const sma13 = calcSMA(data.slice(37));
        const sma21 = calcSMA(data.slice(29));
        const sma50 = calcSMA(data);

        console.clear();
        console.log(new Date().toLocaleTimeString(), '| Preço Atual:', price.toFixed(2))
        console.log(`SMA 13: ${sma13.toFixed(2)}`);
        console.log(`SMA 21: ${sma21.toFixed(2)}`);
        console.log(`SMA 50: ${sma50.toFixed(2)}`);
        console.log(`IsOpened? ${isOpened}`);

        // <<< LÓGICA ATUALIZADA >>>
        if (isOpened) {
            console.log(`Posição Aberta: Preço de Entrada ${longPosition.entryPrice.toFixed(2)}`);
            console.log(`--> Meta Take Profit: ${longPosition.takeProfit.toFixed(2)}`);
            console.log(`--> Meta Stop Loss:   ${longPosition.stopLoss.toFixed(2)}`);

            // 1. CHECAR TAKE PROFIT
            if (price >= longPosition.takeProfit) {
                console.log(`Vender BTCUSDT (TAKE PROFIT ATINGIDO)`);
                operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'TP' });
                isOpened = false;
                longPosition = null;
            }
            // 2. CHECAR STOP LOSS
            else if (price <= longPosition.stopLoss) {
                console.log(`Vender BTCUSDT (STOP LOSS ATINGIDO)`);
                operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'SL' });
                isOpened = false;
                longPosition = null;
            }
            // 3. CHECAR SINAL DE REVERSÃO
            else if (sma13 < sma21) {
                console.log('Vender BTCUSDT (Tendência Revertida)');
                operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'Reversão SMA' });
                isOpened = false;
                longPosition = null;
            } else {
                console.log('Aguardar (Posição Aberta)');
            }

        } else {
            // LÓGICA DE COMPRA (PERMANECE A MESMA)
            if (sma13 > sma21 && price > sma50) {
                console.log('Comprar BTCUSDT (Sinal Filtrado)');
                isOpened = true;
                // <<< NOVO >>> Armazena os dados da posição
                longPosition = {
                    entryPrice: price,
                    takeProfit: price * (1 + TP_PERCENTAGE),
                    stopLoss: price * (1 - SL_PERCENTAGE)
                };
                operations.push({ tipo: 'compra', preco: price, hora: new Date().toLocaleTimeString() });
            } else {
                console.log('Aguardar (Filtrando)');
            }
        }

    } catch (error) {
        console.clear();
        console.error(`\n======================================================`);
        console.error(`[⚠️ ERRO DE CONEXÃO ${new Date().toLocaleString()}]: Não foi possível buscar dados.`);
        console.error(`Motivo: ${error.message}`);
        console.error('O bot irá pausar esta verificação e tentar novamente em 3 segundos...');
        mostrarResultadoImediato();
    }
}

// =================================================================
// FUNÇÃO DE RELATÓRIO PERSISTENTE (Salva em ARQUIVO SEPARADO)
// =================================================================
function mostrarResultadoParcial() {
    let logContent = '';

    logContent += '\n' + '='.repeat(50) + '\n';
    logContent += `RELATÓRIO PARCIAL: ${new Date().toLocaleString()}\n`;
    logContent += '='.repeat(50) + '\n';

    let saldo = 0;
    let ultimaCompra = null;
    let percentualTotal = 0;
    let operacoesCompletas = 0;

    operations.forEach(op => {
        const motivo = op.motivo ? ` - Motivo: ${op.motivo}` : '';
        const opLine = `${op.hora} - ${op.tipo.toUpperCase()} a ${op.preco.toFixed(2)}${motivo}\n`;
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

    try {
        fs.appendFileSync('relatorio_TPSL.log', logContent);
        console.log(`\n[INFO - ${new Date().toLocaleTimeString()}] Relatório periódico salvo em 'relatorio_filtrado_TPSL.log'.`);
    } catch (err) {
        console.error(`[ERRO FS] Não foi possível salvar o relatório: ${err}`);
    }
}


// ======================================================
// CHAMADAS DE INICIALIZAÇÃO DO BOT 
// ======================================================

const checkInterval = setInterval(startTransition, 3000);
startTransition();

// O relatório agora é a cada 4 horas
const reportInterval = setInterval(mostrarResultadoParcial, 4 * 60 * 60 * 1000);