const axios = require('axios');
const fs = require('fs');
const { ADX } = require('technicalindicators');

// =================================================================
// CONFIGURAÇÕES DO BOT
// =================================================================
const SYMBOL = 'BTCUSDT';
const API_URL = "https://testnet.binance.vision";

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

function mostrarResultadoImediato() {
    let saldo = 0;
    let ultimaCompra = null;
    operations.forEach(op => {
        if (op.tipo === 'compra') {
            ultimaCompra = op.preco;
        } else if (op.tipo === 'venda' && ultimaCompra !== null) {
            const lucro = op.preco - ultimaCompra;
            saldo += lucro;
            ultimaCompra = null;
        }
    });

    console.log(`\nLucro/Prejuízo até a falha: ${saldo.toFixed(2)} USD`);
    console.log(`Posição aberta (isOpened): ${isOpened ? 'Sim' : 'Não'}`);
    console.log('======================================================\n');
}

// =================================================================
// FUNÇÃO PRINCIPAL (COM FILTRO ADX)
// =================================================================
async function startTransition() {
    try {
        // Buscamos 100 velas para ter dados suficientes para o ADX
        const { data } = await axios.get(API_URL + '/api/v3/klines?limit=100&interval=15m&symbol=' + SYMBOL);
        
        // Prepara os dados para a biblioteca de indicadores
        const formattedData = data.map(candle => ({
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
        }));

        // Calcula o ADX com período padrão de 14
        const adxInput = {
            close: formattedData.map(c => c.close),
            high: formattedData.map(c => c.high),
            low: formattedData.map(c => c.low),
            period: 14
        };
        const adxResult = ADX.calculate(adxInput);
        const lastAdx = adxResult[adxResult.length - 1];
        const adx = lastAdx.adx; // Força da tendência
        const pdi = lastAdx.pdi; // +DI (Força compradora)
        const mdi = lastAdx.mdi; // -DI (Força vendedora)

        // Calcula as SMAs (com slices ajustados para 100 velas)
        const candle = data[data.length - 1];
        const price = parseFloat(candle[4]);
        const sma13 = calcSMA(data.slice(87));
        const sma21 = calcSMA(data.slice(79));
        const sma50 = calcSMA(data.slice(50));

        // Exibe os logs no console
        console.clear();
        console.log(new Date().toLocaleTimeString(), '| Preço Atual:', price.toFixed(2));
        console.log(`SMA 13: ${sma13.toFixed(2)} | SMA 21: ${sma21.toFixed(2)} | SMA 50: ${sma50.toFixed(2)}`);
        console.log(`IsOpened? ${isOpened}`);
        console.log('--------------------------------------------------');
        console.log(`ADX: ${adx.toFixed(2)} | +DI (Verde): ${pdi.toFixed(2)} | -DI (Vermelho): ${mdi.toFixed(2)}`);

        // Define as condições do filtro de tendência
        const trendIsStrong = adx > 25;
        const trendIsUp = pdi > mdi;

        console.log(`Filtro de Tendência: ${trendIsStrong ? 'FORTE' : 'FRACA'}`);
        console.log(`Direção da Força: ${trendIsUp ? 'COMPRADORA' : 'VENDEDORA'}`);
        console.log('--------------------------------------------------');

        if (isOpened) {
            console.log(`Posição Aberta: Preço de Entrada ${longPosition.entryPrice.toFixed(2)}`);
            console.log(`--> Meta Take Profit: ${longPosition.takeProfit.toFixed(2)}`);
            console.log(`--> Meta Stop Loss:   ${longPosition.stopLoss.toFixed(2)}`);

            if (price >= longPosition.takeProfit) {
                console.log(`Vender BTCUSDT (TAKE PROFIT ATINGIDO)`);
                operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'TP' });
                isOpened = false;
                longPosition = null;
            } else if (price <= longPosition.stopLoss) {
                console.log(`Vender BTCUSDT (STOP LOSS ATINGIDO)`);
                operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'SL' });
                isOpened = false;
                longPosition = null;
            } else if (sma13 < sma21 && price < sma50) {
                console.log('Vender BTCUSDT (Tendência Revertida)');
                operations.push({ tipo: 'venda', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'Reversão SMA' });
                isOpened = false;
                longPosition = null;
            } else {
                console.log('Aguardar (Posição Aberta)');
            }

        } else {
            // LÓGICA DE COMPRA COM FILTRO DE REGIME (ADX)
            if (trendIsStrong && trendIsUp && sma13 > sma21 && price > sma50) {
                console.log('Comprar BTCUSDT (Sinal Filtrado com Tendência Forte)');
                isOpened = true;
                longPosition = {
                    entryPrice: price,
                    takeProfit: price * (1 + TP_PERCENTAGE),
                    stopLoss: price * (1 - SL_PERCENTAGE)
                };
                operations.push({ tipo: 'compra', preco: price, hora: new Date().toLocaleTimeString() });
            } else {
                console.log('Aguardar (Filtrando - Sem Tendência Forte o Suficiente)');
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
// FUNÇÃO DE RELATÓRIO PERSISTENTE
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
        // Sugestão: Salvar em um novo arquivo para não misturar os resultados
        fs.appendFileSync('relatorio_ADX.log', logContent);
        console.log(`\n[INFO - ${new Date().toLocaleTimeString()}] Relatório periódico salvo em 'relatorio_ADX.log'.`);
    } catch (err) {
        console.error(`[ERRO FS] Não foi possível salvar o relatório: ${err}`);
    }
}

// ======================================================
// CHAMADAS DE INICIALIZAÇÃO DO BOT 
// ======================================================
const checkInterval = setInterval(startTransition, 3000);
startTransition();

// O relatório é a cada 4 horas
const reportInterval = setInterval(mostrarResultadoParcial, 4 * 60 * 60 * 1000);