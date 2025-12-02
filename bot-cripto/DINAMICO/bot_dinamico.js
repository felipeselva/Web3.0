const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const { ADX, ATR } = require('technicalindicators');

// =================================================================
// CONFIGURAÇÕES DO BOT
// =================================================================
const SYMBOL = 'BTCUSDT';
const QUOTE_ASSET = 'USDT';
const BASE_ASSET = 'BTC';

// --- CONFIGURAÇÕES DE RISCO ---
const RISK_PER_TRADE = 0.01; 

// --- CONFIGURAÇÕES DE ENTRADA E SAÍDA ---
const SL_PERCENTAGE = 0.005;
const PARTIAL_TP_PERCENTAGE = 0.007;
const PARTIAL_TP_SELL_RATIO = 0.5;

// --- CONFIGURAÇÕES DO TRAILING STOP ---
const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 2.0;

// --- CHAVES DE API (TESTNET) ---
const API_KEY = 'ClqcbCxG4BX5ZUNd0iaZvXiqGZHfEDpEjKnuAs2biSQ2qGAiL2z321REcmYqEMeX'; 
const SECRET_KEY = '0BfQwEhBkRubE1U0JQSaHkYDerou9e2O7YbxfgSZXb3TM7tqpIDkQt1r81VPRXEK'; 
const API_URL = "https://testnet.binance.vision";

// =================================================================
// VARIÁVEIS DE ESTADO
// =================================================================
let positionState = 'NONE';
let longPosition = null;
let operations = [];

// =================================================================
// FUNÇÕES AUXILIARES E DE API
// =================================================================

async function getServerTime() {
    try {
        const { data } = await axios.get(API_URL + '/api/v3/time');
        return data.serverTime;
    } catch (error) {
        console.error("❌ ERRO ao obter horário da Binance.");
        return Date.now();
    }
}

async function newOrder(symbol, quantity, side) {
    const sideUpperCase = side.toUpperCase();
    const serverTime = await getServerTime();
    const order = {
        symbol,
        quantity,
        side: sideUpperCase,
        type: "MARKET",
        timestamp: serverTime,
        recvWindow: 15000
    };
    const signedQuery = new URLSearchParams(order).toString();
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(signedQuery).digest('hex');
    const requestBody = `${signedQuery}&signature=${signature}`;
    try {
        const { data } = await axios.post(
            API_URL + '/api/v3/order?' + requestBody,
            null,
            { headers: { 'X-MBX-APIKEY': API_KEY } }
        );
        console.log(`✅ Ordem de ${sideUpperCase} executada com sucesso!`);
        return data;
    } catch (error) {
        console.error(`❌ ERRO ao executar ordem de ${sideUpperCase}:`);
        if (error.response) {
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
        return null;
    }
}

async function getAccountBalances(assets = [BASE_ASSET, QUOTE_ASSET]) {
    try {
        const serverTime = await getServerTime();
        const params = {
            timestamp: serverTime,
            recvWindow: 15000
        };
        const queryString = new URLSearchParams(params).toString();
        const signature = crypto.createHmac('sha256', SECRET_KEY).update(queryString).digest('hex');
        const { data } = await axios.get(`${API_URL}/api/v3/account?${queryString}&signature=${signature}`, {
            headers: { 'X-MBX-APIKEY': API_KEY }
        });
        const balances = {};
        assets.forEach(asset => {
            balances[asset] = 0;
        });
        data.balances.forEach(bal => {
            if (assets.includes(bal.asset)) {
                balances[bal.asset] = parseFloat(bal.free);
            }
        });
        return balances;
    } catch (error) {
        console.error("❌ ERRO ao obter saldos da conta:", error.response ? error.response.data : error.message);
        return null;
    }
}

function formatQuantity(quantity) {
    return Math.floor(quantity * 100000) / 100000;
}

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
        } else if (op.tipo.startsWith('venda') && ultimaCompra !== null) {
            saldo += (op.preco - ultimaCompra);
            ultimaCompra = null;
        }
    });
    console.log(`\nLucro/Prejuízo até a falha: ${saldo.toFixed(2)} USD`);
    console.log(`Posição aberta: ${positionState}`);
    console.log('======================================================\n');
}

// =================================================================
// FUNÇÃO PRINCIPAL
// =================================================================
async function startTransition() {
    try {
        const balances = await getAccountBalances();
        if (!balances) {
            console.log("Não foi possível obter os saldos. Tentando novamente em 3 segundos...");
            return;
        }

        const { data } = await axios.get(API_URL + '/api/v3/klines?limit=100&interval=15m&symbol=' + SYMBOL);
        const formattedData = data.map(c => ({ high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]) }));

        const adxInput = { close: formattedData.map(c => c.close), high: formattedData.map(c => c.high), low: formattedData.map(c => c.low), period: 14 };
        const adxResult = ADX.calculate(adxInput);
        const lastAdx = adxResult[adxResult.length - 1];
        const adx = lastAdx.adx, pdi = lastAdx.pdi, mdi = lastAdx.mdi;
        
        const atrInput = { high: formattedData.map(c => c.high), low: formattedData.map(c => c.low), close: formattedData.map(c => c.close), period: ATR_PERIOD };
        const atrResult = ATR.calculate(atrInput);
        const lastAtr = atrResult[atrResult.length - 1];
        
        const price = parseFloat(data[data.length - 1][4]);
        const sma13 = calcSMA(data.slice(87)), sma21 = calcSMA(data.slice(79)), sma50 = calcSMA(data.slice(50));
        
        console.clear();
        console.log(`SALDOS: | ${BASE_ASSET}: ${balances[BASE_ASSET].toFixed(5)} | ${QUOTE_ASSET}: ${balances[QUOTE_ASSET].toFixed(2)}`);
        console.log('================================================================');
        console.log(`${new Date().toLocaleString()} | Preço Atual: ${price.toFixed(2)}`);
        console.log(`Posição Atual: ${positionState}`);
        console.log(`SMA 13: ${sma13.toFixed(2)} | SMA 21: ${sma21.toFixed(2)} | SMA 50: ${sma50.toFixed(2)}`);
        console.log('--------------------------------------------------');
        console.log(`ADX: ${adx.toFixed(2)} | +DI: ${pdi.toFixed(2)} | -DI: ${mdi.toFixed(2)} | ATR: ${lastAtr.toFixed(2)}`);
        const trendIsStrong = adx > 25, trendIsUp = pdi > mdi;
        console.log(`Filtro: Tendência ${trendIsStrong ? 'FORTE' : 'FRACA'} | Direção: ${trendIsUp ? 'COMPRADORA' : 'VENDEDORA'}`);
        console.log('--------------------------------------------------');

        if (positionState !== 'NONE') {
            const trailingStopPrice = price - (ATR_MULTIPLIER * lastAtr);
            if (trailingStopPrice > longPosition.stopLoss) {
                console.log(`📈 TRAILING STOP ATUALIZADO! Novo SL: ${trailingStopPrice.toFixed(2)}`);
                longPosition.stopLoss = trailingStopPrice;
            }

            console.log(`Posição Aberta: Entrada ${longPosition.entryPrice.toFixed(2)} | Qtd Restante: ${longPosition.remainingQuantity.toFixed(5)}`);
            console.log(`--> Meta TP Parcial: ${longPosition.takeProfit1.toFixed(2)}`);
            console.log(`--> Meta Stop Loss ATUAL: ${longPosition.stopLoss.toFixed(2)} (Trailing)`);

            if (positionState === 'FULL' && price >= longPosition.takeProfit1) {
                const partialQuantity = formatQuantity(longPosition.initialQuantity * PARTIAL_TP_SELL_RATIO);
                console.log(`Tentando VENDER ${partialQuantity} (TAKE PROFIT PARCIAL)...`);
                const orderResult = await newOrder(SYMBOL, partialQuantity, 'SELL');
                if (orderResult) {
                    operations.push({ tipo: 'venda_parcial', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'TP1' });
                    positionState = 'PARTIAL';
                    longPosition.remainingQuantity -= partialQuantity;
                    longPosition.stopLoss = longPosition.entryPrice;
                    console.log(`✅ TP PARCIAL ATINGIDO! SL movido para o preço de entrada (Breakeven).`);
                }
            } else if (price <= longPosition.stopLoss) {
                const finalQuantity = formatQuantity(longPosition.remainingQuantity);
                console.log(`Tentando VENDER ${finalQuantity} (STOP LOSS ATINGIDO)...`);
                const orderResult = await newOrder(SYMBOL, finalQuantity, 'SELL');
                if (orderResult) {
                    operations.push({ tipo: 'venda_final', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'SL/Trailing' });
                    positionState = 'NONE';
                    longPosition = null;
                }
            } else if (sma13 < sma21 && price < sma50) {
                const finalQuantity = formatQuantity(longPosition.remainingQuantity);
                console.log(`Tentando VENDER ${finalQuantity} (Reversão SMA)...`);
                const orderResult = await newOrder(SYMBOL, finalQuantity, 'SELL');
                if (orderResult) {
                    operations.push({ tipo: 'venda_final', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'Reversão SMA' });
                    positionState = 'NONE';
                    longPosition = null;
                }
            } else {
                console.log('Aguardar (Posição Aberta)');
            }

        } else { // Se Posição for 'NONE'
            if (trendIsStrong && trendIsUp && sma13 > sma21 && price > sma50) {
                console.log('Sinal de compra detectado. Calculando tamanho da posição...');
                const availableBalance = balances[QUOTE_ASSET];
                if (availableBalance > 20) {
                    const stopLossPrice = price * (1 - SL_PERCENTAGE);
                    const riskAmount = availableBalance * RISK_PER_TRADE;
                    const stopLossDistance = price - stopLossPrice;
                    
                    const desiredQuantity = riskAmount / stopLossDistance;
                    const maxAffordableQuantity = availableBalance / price;
                    const finalQuantity = formatQuantity(Math.min(desiredQuantity, maxAffordableQuantity));

                    if (finalQuantity * price > 10) {
                        console.log(`Saldo: ${availableBalance.toFixed(2)}. Risco: ${riskAmount.toFixed(2)}. Qtd Final: ${finalQuantity}`);
                        const orderResult = await newOrder(SYMBOL, finalQuantity, 'BUY');
                        if (orderResult) {
                            positionState = 'FULL';
                            longPosition = {
                                entryPrice: price,
                                takeProfit1: price * (1 + PARTIAL_TP_PERCENTAGE),
                                stopLoss: stopLossPrice,
                                initialQuantity: finalQuantity,
                                remainingQuantity: finalQuantity
                            };
                            operations.push({ tipo: 'compra', preco: price, hora: new Date().toLocaleTimeString() });
                        }
                    } else {
                        console.log(`Quantidade calculada (${finalQuantity}) resulta em valor menor que 10 USDT. Ordem não enviada.`);
                    }
                } else {
                    console.log(`Saldo insuficiente (${availableBalance.toFixed(2)}).`);
                }
            } else {
                console.log('Aguardar (Filtrando)');
            }
        }
    } catch (error) {
        console.error(`\n[⚠️ ERRO GERAL]: ${error.message}`);
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
        } else if (op.tipo.startsWith('venda') && ultimaCompra !== null) {
            saldo += (op.preco - ultimaCompra);
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
        fs.appendFileSync('relatorio_dinamico.log', logContent);
        console.log(`\n[INFO] Relatório periódico salvo em 'relatorio_dinamico.log'.`);
    } catch (err) {
        console.error(`[ERRO FS] Não foi possível salvar o relatório: ${err}`);
    }
}

// ======================================================
// CHAMADAS DE INICIALIZAÇÃO DO BOT 
// ======================================================
const checkInterval = setInterval(startTransition, 3000);
startTransition();
const reportInterval = setInterval(mostrarResultadoParcial, 4 * 60 * 60 * 1000);
