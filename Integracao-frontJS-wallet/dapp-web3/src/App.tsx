import React, { useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { ethers, formatEther } from 'ethers';

function App() {

  async function connect() {

  const provider = new ethers.BrowserProvider(window.ethereum); 
  const accounts = await provider.send("eth_requestAccounts", []);
  
    const balance = await provider.getBalance(accounts[0]);
  alert(ethers.formatEther(balance));
  
  //const signer = provider.getSigner(accounts[0]);
  //(await signer).sendTransaction ({ to:"0xA28bf290a6CD44c4A53533e37887779b4dd6c9fe", value: ethers.parseEther("0.00") });



 
  
}
  useEffect(() => {

    connect();

}, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;