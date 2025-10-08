const axios = require('axios')
const fs = require('fs'); // Módulo para salvar relatórios em arquivo
const SYMBOL = 'BTCUSDT' 
const BUY_PRICE = 121900 // Não utilizado na lógica principal
const SELL_PRICE = 122400 // Não utilizado na lógica principal

const API_URL = "https://testnet.binance.vision";

let isOpened = false;
let operations = [];


function calcSMA(data){
    const closes = data.map(candle => parseFloat(candle[4]));
    const sum = closes.reduce((acc, val) => acc + val);
    return sum / data.length;
}

// =================================================================
// FUNÇÃO DE RELATÓRIO DE EMERGÊNCIA (Mostra o estado atual na falha)
// =================================================================
function mostrarResultadoImediato() {
    let saldo = 0;
    let ultimaCompra = null;
    let operacoesCompletas = 0;
    let percentualTotal = 0;

    // Apenas calcula o saldo com base nas operações já registradas
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
    console.log(`Operações completas: ${operacoesCompletas}`);
    console.log(`Posição aberta (isOpened): ${isOpened ? 'Sim' : 'Não'}`);
    console.log('======================================================\n');
}

// =================================================================
// FUNÇÃO PRINCIPAL DE EXECUÇÃO (Com tratamento de erro de conexão)
// =================================================================
async function startTransition(){
    try {
        // Tenta buscar os dados da Binance
        const {data} = await axios.get(API_URL + '/api/v3/klines?limit=21&interval=15m&symbol=' + SYMBOL);
        
        // Se a busca for bem-sucedida, executa a lógica de trade
        const candle = (data[data.length -1]);
        const price = parseFloat(candle[4]);

        console.clear();
        console.log(new Date().toLocaleTimeString(), '| Preço Atual:', price.toFixed(2))

        const sma13 = calcSMA(data.slice(8));
        console.log(`SMA 13: ${sma13.toFixed(2)}`);
        const sma21 = calcSMA(data);
        console.log(`SMA 21: ${sma21.toFixed(2)}`);
        console.log(`IsOpened? ${isOpened}`);


        // Lógica de Compra e Venda (Cruzamento de SMAs)
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
        
    } catch (error) {
        // Bloco de tratamento de erro de conexão (ENOTFOUND, Timeout, etc.)
        console.clear();
        console.error(`\n======================================================`);
        console.error(`[⚠️ ERRO DE CONEXÃO ${new Date().toLocaleString()}]: Não foi possível buscar dados.`);
        console.error(`Motivo: ${error.message}`);
        console.error('O bot irá pausar esta verificação e tentar novamente em 5 segundos...');
        
        // MOSTRA O ÚLTIMO ESTADO ANTES DE TENTAR O PRÓXIMO CICLO
        mostrarResultadoImediato(); 
    }
}

// =================================================================
// FUNÇÃO DE RELATÓRIO PERSISTENTE (Salva em arquivo .log a cada 6h)
// =================================================================
function mostrarResultadoParcial() {
    let logContent = ''; // Variável para armazenar o texto do relatório
    
    // 1. INÍCIO DO LOG
    logContent += '\n' + '='.repeat(50) + '\n';
    logContent += `RELATÓRIO PARCIAL APÓS 6 HORAS: ${new Date().toLocaleString()}\n`;
    logContent += '='.repeat(50) + '\n';
    
    let saldo = 0;
    let ultimaCompra = null;
    let percentualTotal = 0;
    let operacoesCompletas = 0;

    // 2. LISTA DE OPERAÇÕES
    operations.forEach(op => {
        const opLine = `${op.hora} - ${op.tipo.toUpperCase()} a ${op.preco.toFixed(2)}\n`;
        logContent += opLine; // Adiciona ao log
        
        // Lógica de cálculo 
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

    // 3. RESUMO DO PERÍODO
    logContent += `\nLucro/Prejuízo NO PERÍODO: ${saldo.toFixed(2)} USD\n`;
    if (operacoesCompletas > 0) {
        logContent += `Percentual médio por operação: ${(percentualTotal / operacoesCompletas).toFixed(2)}%\n`;
    } else {
        logContent += 'Nenhuma operação completa realizada neste período.\n';
    }
    logContent += '='.repeat(50) + '\n';
    
    // CRUCIAL: Resetar o histórico para o próximo ciclo
    operations = [];
    
    // 4. SALVAR NO ARQUIVO
    try {
        // Salva (anexa) o relatório no arquivo relatorio_bot.log
        fs.appendFileSync('relatorio_bot.log', logContent);
        
        // Imprime no terminal a confirmação
        console.log(`\n[INFO - ${new Date().toLocaleTimeString()}] Relatório de 6 horas salvo em 'relatorio_bot.log'.`);
        
    } catch (err) {
        console.error(`[ERRO FS] Não foi possível salvar o relatório: ${err}`);
    }
}


// ======================================================
// CHAMADAS DE INICIALIZAÇÃO DO BOT 
// ======================================================

const checkInterval = setInterval(startTransition, 5000); // Executa a verificação a cada 5 segundos
startTransition(); // Executa imediatamente ao iniciar

const reportInterval = setInterval(mostrarResultadoParcial, 3 * 60 * 60 * 1000); // Relatório a cada 3 horas