"use strict";
require("dotenv").config();
const { ethers, AbiCoder } = require("ethers");

var rpcBaseAddress="";
var privateKey="";

function init() {
  rpcBaseAddress = process.env.OTHENTIC_CLIENT_RPC_ADDRESS;
  privateKey = process.env.PRIVATE_KEY_PERFORMER;
}

async function sendTaskToContract(proofOfTask, data, taskDefinitionId) {
  // This stuff was (mostly) written by Othentic and should work out the box
  // Data formatted correctly previously, now we just send

  const wallet = new ethers.Wallet(privateKey);
  const message = ethers.AbiCoder.defaultAbiCoder().encode(["string", "bytes", "address", "uint16"], [proofOfTask, data, wallet.address, taskDefinitionId]);
  const messageHash = ethers.keccak256(message);
  const sig = wallet.signingKey.sign(messageHash).serialized;

  const jsonRpcBody = {
    jsonrpc: "2.0",
    method: "sendTask",
    params: [
      proofOfTask,
      data,
      taskDefinitionId,
      wallet.address,
      sig,
    ]
  };

  try {
    const provider = new ethers.JsonRpcProvider(rpcBaseAddress);
    const response = await provider.send(jsonRpcBody.method, jsonRpcBody.params);
    console.log("API response:", response);
    return true;
  } catch (error) {
    console.error("Error making API request:", error);
    return false;
  }
}


// async function sendCreateOrderTask(proofOfTask, data, taskDefinitionId) {
//   // This stuff was written by Othentic (apart from msgData modifications) and should work out the box
  
//   const wallet = new ethers.Wallet(privateKey);
//   const performerAddress = wallet.address;
//   const msgData = ethers.AbiCoder.defaultAbiCoder().encode(['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'], [data])
//   const message = ethers.AbiCoder.defaultAbiCoder().encode(["string", "bytes", "address", "uint16"], [proofOfTask, msgData, performerAddress, taskDefinitionId]);
//   const messageHash = ethers.keccak256(message);
//   const sig = wallet.signingKey.sign(messageHash).serialized;

//   const jsonRpcBody = {
//     jsonrpc: "2.0",
//     method: "sendTask",
//     params: [
//       proofOfTask,
//       msgData,
//       taskDefinitionId,
//       performerAddress,
//       sig,
//     ]
//   };
//   try {
//     const provider = new ethers.JsonRpcProvider(rpcBaseAddress);
//     const response = await provider.send(jsonRpcBody.method, jsonRpcBody.params);
//     console.log("API response:", response);
//     return true;
//   } catch (error) {
//     console.error("Error making API request:", error);
//     return false;
//   }
// }

// async function sendUpdateBestPriceTask(proofOfTask, data, taskDefinitionId) {

//   var wallet = new ethers.Wallet(privateKey);
//   var performerAddress = wallet.address;
//   data = ethers.AbiCoder.defaultAbiCoder().encode(['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'], [data])
//   const message = ethers.AbiCoder.defaultAbiCoder().encode(["string", "bytes", "address", "uint16"], [proofOfTask, data, performerAddress, taskDefinitionId]);
//   const messageHash = ethers.keccak256(message);
//   const sig = wallet.signingKey.sign(messageHash).serialized;

//   const jsonRpcBody = {
//     jsonrpc: "2.0",
//     method: "sendTask",
//     params: [
//       proofOfTask,
//       data,
//       taskDefinitionId,
//       performerAddress,
//       sig,
//     ]
//   };
//   try {
//     const provider = new ethers.JsonRpcProvider(rpcBaseAddress);
//     const response = await provider.send(jsonRpcBody.method, jsonRpcBody.params);
//     console.log("API response:", response);

//     return true;
//   } catch (error) {
//     console.error("Error making API request:", error);
//     return false;
//   }
// }

// async function sendCancelOrderTask(proofOfTask, data, taskDefinitionId) {

//   var wallet = new ethers.Wallet(privateKey);
//   var performerAddress = wallet.address;
//   data = ethers.AbiCoder.defaultAbiCoder().encode(['tuple(uint256 orderId, bool isBid, address baseAsset, address quoteAsset, uint256 timestamp)'], [data])
//   const message = ethers.AbiCoder.defaultAbiCoder().encode(["string", "bytes", "address", "uint16"], [proofOfTask, data, performerAddress, taskDefinitionId]);
//   const messageHash = ethers.keccak256(message);
//   const sig = wallet.signingKey.sign(messageHash).serialized;

//   const jsonRpcBody = {
//     jsonrpc: "2.0",
//     method: "sendTask",
//     params: [
//       proofOfTask,
//       data,
//       taskDefinitionId,
//       performerAddress,
//       sig,
//     ]
//   };
//   try {
//     const provider = new ethers.JsonRpcProvider(rpcBaseAddress);
//     const response = await provider.send(jsonRpcBody.method, jsonRpcBody.params);
//     console.log("API response:", response);

//     return true;
//   } catch (error) {
//     console.error("Error making API request:", error);
//     return false;
//   }
// }

// async function sendFillOrderTask(proofOfTask, data, taskDefinitionId) {

//   var wallet = new ethers.Wallet(privateKey);
//   var performerAddress = wallet.address;
//   data = ethers.AbiCoder.defaultAbiCoder().encode(['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'], [data])
//   const message = ethers.AbiCoder.defaultAbiCoder().encode(["string", "bytes", "address", "uint16"], [proofOfTask, data, performerAddress, taskDefinitionId]);
//   const messageHash = ethers.keccak256(message);
//   const sig = wallet.signingKey.sign(messageHash).serialized;

//   const jsonRpcBody = {
//     jsonrpc: "2.0",
//     method: "sendTask",
//     params: [
//       proofOfTask,
//       data,
//       taskDefinitionId,
//       performerAddress,
//       sig,
//     ]
//   };
//   try {
//     const provider = new ethers.JsonRpcProvider(rpcBaseAddress);
//     const response = await provider.send(jsonRpcBody.method, jsonRpcBody.params);
//     console.log("API response:", response);

//     return true;
//   } catch (error) {
//     console.error("Error making API request:", error);
//     return false;
//   }
// } 

module.exports = {
  init,
  // sendCreateOrderTask,
  // sendUpdateBestPriceTask,
  // sendCancelOrderTask,
  // sendFillOrderTask,
  sendTaskToContract
}
