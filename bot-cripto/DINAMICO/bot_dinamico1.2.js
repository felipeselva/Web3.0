const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const { ADX, ATR } = require('technicalindicators');

// =================================================================
// CONFIGURAÇÕES DO BOT (VERSÃO 1.2)
// =================================================================
const SYMBOL = 'BTCUSDT';
const QUOTE_ASSET = 'USDT';
const BASE_ASSET = 'BTC';

// --- CONFIGURAÇÕES DE RISCO ---
const CAPITAL_ALLOCATION_PER_TRADE = 0.01;
const MIN_RISK_REWARD_RATIO = 1.5;

// --- CONFIGURAÇÕES DE ANÁLISE TÉCNICA ---
const LOOKBACK_PERIOD = 20;
const PARTIAL_TP_SELL_RATIO = 0.5;
const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 2.0;

// --- CHAVES DE API (TESTNET) ---
const API_KEY = '';
const SECRET_KEY = '';
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
async function getServerTime() { try { const { data } = await axios.get(API_URL + '/api/v3/time'); return data.serverTime; } catch (error) { console.error("❌ ERRO ao obter horário da Binance."); return Date.now(); } }
async function newOrder(symbol, quantity, side) { const sideUpperCase = side.toUpperCase(); const serverTime = await getServerTime(); const order = { symbol, quantity, side: sideUpperCase, type: "MARKET", timestamp: serverTime, recvWindow: 15000 }; const signedQuery = new URLSearchParams(order).toString(); const signature = crypto.createHmac('sha256', SECRET_KEY).update(signedQuery).digest('hex'); const requestBody = `${signedQuery}&signature=${signature}`; try { const { data } = await axios.post(API_URL + '/api/v3/order?' + requestBody, null, { headers: { 'X-MBX-APIKEY': API_KEY } }); console.log(`✅ Ordem de ${sideUpperCase} executada com sucesso!`); return data; } catch (error) { console.error(`❌ ERRO ao executar ordem de ${sideUpperCase}:`); if (error.response) { console.log(error.response.data); } else { console.log(error.message); } return null; } }
async function getAccountBalances(assets = [BASE_ASSET, QUOTE_ASSET]) { try { const serverTime = await getServerTime(); const params = { timestamp: serverTime, recvWindow: 15000 }; const queryString = new URLSearchParams(params).toString(); const signature = crypto.createHmac('sha256', SECRET_KEY).update(queryString).digest('hex'); const { data } = await axios.get(`${API_URL}/api/v3/account?${queryString}&signature=${signature}`, { headers: { 'X-MBX-APIKEY': API_KEY } }); const balances = {}; assets.forEach(asset => { balances[asset] = 0; }); data.balances.forEach(bal => { if (assets.includes(bal.asset)) { balances[bal.asset] = parseFloat(bal.free); } }); return balances; } catch (error) { console.error("❌ ERRO ao obter saldos da conta:", error.response ? error.response.data : error.message); return null; } }
function getMarketStructure(data, period) { const lookbackData = data.slice(-period); let highestHigh = 0; let lowestLow = Infinity; for (const candle of lookbackData) { const high = parseFloat(candle[2]); const low = parseFloat(candle[3]); if (high > highestHigh) highestHigh = high; if (low < lowestLow) lowestLow = low; } return { highestHigh, lowestLow }; }
function formatQuantity(quantity) { return Math.floor(quantity * 100000) / 100000; }
function calcSMA(data) { const closes = data.map(candle => parseFloat(candle[4])); const sum = closes.reduce((acc, val) => acc + val); return sum / data.length; }
function mostrarResultadoImediato() { let saldo = 0; let ultimaCompra = null; operations.forEach(op => { if (op.tipo === 'compra') { ultimaCompra = op.preco; } else if (op.tipo.startsWith('venda') && ultimaCompra !== null) { saldo += (op.preco - ultimaCompra); ultimaCompra = null; } }); console.log(`\nLucro/Prejuízo até a falha: ${saldo.toFixed(2)} USD`); console.log(`Posição aberta: ${positionState}`); console.log('======================================================\n'); }

// =================================================================
// FUNÇÃO PRINCIPAL
// =================================================================
async function startTransition() {
    try {
        const balances = await getAccountBalances();
        if (!balances) { return; }

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
                const orderResult = await newOrder(SYMBOL, finalQuantity, 'SELL');
                if (orderResult) {
                    operations.push({ tipo: 'venda_final', preco: price, hora: new Date().toLocaleTimeString(), motivo: 'SL/Trailing' });
                    positionState = 'NONE';
                    longPosition = null;
                }
            } else if (sma13 < sma21 && price < sma50) {
                const finalQuantity = formatQuantity(longPosition.remainingQuantity);
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
                console.log('Sinal de compra detectado. Analisando estrutura de mercado...');
                const { highestHigh, lowestLow } = getMarketStructure(data, LOOKBACK_PERIOD);
                const potentialStopLoss = lowestLow;
                const potentialTakeProfit1 = highestHigh;

                if (potentialStopLoss >= price || potentialTakeProfit1 <= price) {
                    console.log('Alvos dinâmicos inválidos. Aguardando...');
                    return;
                }
                
                const riskDistance = price - potentialStopLoss;
                const rewardDistance = potentialTakeProfit1 - price;
                const riskRewardRatio = rewardDistance / riskDistance;

                console.log(`Análise R/R: Ratio=${riskRewardRatio.toFixed(2)}`);

                if (riskRewardRatio >= MIN_RISK_REWARD_RATIO) {
                    console.log(`✅ Risco/Retorno OK. Calculando alocação...`);
                    const availableBalance = balances[QUOTE_ASSET];
                    
                    if (availableBalance > 20) {
                        const amountToSpend = availableBalance * CAPITAL_ALLOCATION_PER_TRADE;
                        if (amountToSpend < 10) { return; }
                        const quantityToBuy = formatQuantity(amountToSpend / price);
                        
                        const orderResult = await newOrder(SYMBOL, quantityToBuy, 'BUY');
                        if (orderResult) {
                            positionState = 'FULL';
                            longPosition = {
                                entryPrice: price,
                                takeProfit1: potentialTakeProfit1,
                                stopLoss: potentialStopLoss,
                                initialQuantity: quantityToBuy,
                                remainingQuantity: quantityToBuy
                            };
                            operations.push({ tipo: 'compra', preco: price, hora: new Date().toLocaleTimeString() });
                        }
                    }
                } else {
                    console.log(`❌ Trade ignorado: Risco/Retorno desfavorável.`);
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

    if (operations.length > 0) {
        operations.forEach(op => {
            const motivo = op.motivo ? ` - Motivo: ${op.motivo}` : '';
            const opLine = `${op.hora} - ${op.tipo.toUpperCase()} a ${op.preco.toFixed(2)}${motivo}\n`;
            logContent += opLine;
        });
    } else {
        logContent += 'Nenhuma nova operação registrada neste período.\n';
    }
    
    logContent += '='.repeat(50) + '\n';
    operations = []; // Limpa as operações após registrá-las
    try {
        fs.appendFileSync('relatorio_dinamico1.2.log', logContent);
        console.log(`\n[INFO] Relatório periódico salvo em 'relatorio_dinamico1.2.log'.`);
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
