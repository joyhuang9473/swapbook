require('dotenv').config();
const taskController = require("./task.controller");
const { ethers, AbiCoder } = require("ethers");

// The validator should:
// Receive the (proof of task, data, task definition id)
// Run the order (found in data) through their own order book
// Generate a task id from running the order through their order book
// Generate a proof of task from the order book
// Verify their order book suggests the same task id as the one provided by the performer

// When sending order to order book should get result, one of:
// Task 1: Order does not cross spread and is not best price
// Task 2: Order does not cross spread but is best price
// Task 3: Order crosses spread and partially fills best price
// Task 4: Order crosses spread and completely fills best price (params: next best price order on opposite side)
// Failure: Order crosses spread and fills more than best price (API call fails)

async function validate(proofOfTask, data, taskDefinitionId) {
    try {
        // For withdrawal tasks, we need special handling
        if (taskDefinitionId === taskController.taskDefinitionId.ProcessWithdrawal) {
            return await validateWithdrawal(proofOfTask, data);
        }
        
        // For cancel order tasks, we need special handling
        if (taskDefinitionId === taskController.taskDefinitionId.CancelOrder) {
            return await validateCancelOrder(proofOfTask, data);
        }

        // Check sender signature

        const proofParts = proofOfTask.split("_")[3];
        const timestampStr = proofParts[2];
        const signatureStr = proofParts[3];

        const timestamp = timestampStr.split("-")[1];
        const signature = signatureStr.split("-")[1];

        // TODO: add check that signature corresponds to data in order signed by data.account

        // Send order to order book

        const formData = new FormData();

        formData.append('payload', JSON.stringify({
            account: account,
            price: Number(price),
            quantity: Number(quantity),
            side: side,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            timestamp: timestamp
        }));

        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/register_order`, {
            method: 'POST',
            body: formData
        });
        const new_data = await response.json(); // if it doesn't work try JSON.parse(JSON.stringify(data))


        // Run same checks as Execution Service

        // Check nothing's failed badly
        if (!response.ok) {
            const errorMessage = data.error || data.message || `Failed to create order: HTTP status ${response.status}`;
            throw new CustomError(errorMessage, data);
        }

        // Check we haven't failed to enter order into order book (e.g. if incoming order is larger than best order)
        if (data.status_code == 0) {
            throw new CustomError(`Failed to create order: ${data.message}`, data);
        }

        // Check task ID determined is between 1 and 4 inclusive
        if (data.taskId > 4 || data.taskId < 1) {
            throw new CustomError(`Invalid task ID returned from Order Book Service: ${data.taskId}`, data);
        }

        // Check the necessary data is included correctly from the Order Book (only task 4)
        if (data.taskId == 4 && data.nextBest == undefined) {
            // Complete order fill, need details of next best order on other side
            throw new CustomError(`Next best order details required for Complete Order Fill`, data);
        }

        // Should include order ID for newly inserted order
        if (new_data.order.orderId == undefined) {
            throw new CustomError(`Order ID not included`, data);
        }

        // Get new proof of task

        const new_proofOfTask = `Task_${new_data.taskId}-Order_${new_data.order.orderId}-Timestamp_${timestamp}-Signature_${signature}`;

        return proofOfTask === new_proofOfTask; // isApproved

        // let isApproved = false;

        // if (taskDefinitionId === taskController.taskDefinitionId.CreateOrder) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         account,
        //         sqrtPrice,
        //         amount,
        //         isBid,
        //         baseAsset,
        //         quoteAsset,
        //         quoteAmount,
        //         isValid,
        //         timestamp
        //     } = decodedData[0];
        //     const price = Math.pow(
        //         Number(ethers.formatUnits(sqrtPrice, taskController.decimal)),
        //         2
        //     );
        //     const side = isBid ? 'bid' : 'ask';

        //     // turn address to symbol
        //     const baseAssetSymbol = taskController.token_address_symbol_mapping[baseAsset];
        //     const quoteAssetSymbol = taskController.token_address_symbol_mapping[quoteAsset];
        //     const amountFormatted = Number(ethers.formatUnits(amount, taskController.decimal));
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));

        //     const taskResult = await taskController.createOrder(account, price, amountFormatted, side, baseAssetSymbol, quoteAssetSymbol, timestampFormatted);
        //     const predictedProofOfTask = `CreateOrder-${side}-${taskResult['order']['order_id']}-${timestampFormatted}`;

        //     if (predictedProofOfTask === proofOfTask) {
        //         isApproved = true;
        //     }
        // } else if (taskDefinitionId === taskController.taskDefinitionId.FillOrder) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         account,
        //         sqrtPrice,
        //         amount,
        //         isBid,  
        //         baseAsset,
        //         quoteAsset,
        //         quoteAmount,
        //         isValid,
        //         timestamp
        //     } = decodedData[0];
        //     const side = isBid ? 'bid' : 'ask';
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));
        //     const predictedProofOfTask = `FillOrder-${side}-${orderId}-${timestampFormatted}`;

        //     if (predictedProofOfTask === proofOfTask) {
        //         isApproved = true;  
        //     }
        // } else if (taskDefinitionId === taskController.taskDefinitionId.CancelOrder) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, bool isBid, address baseAsset, address quoteAsset, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         isBid,
        //         baseAsset,
        //         quoteAsset,
        //         timestamp
        //     } = decodedData[0];
        //     const side = isBid ? 'bid' : 'ask';
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));

        //     const taskResult = await taskController.cancelOrder(orderId, side, baseAsset, quoteAsset);
        //     const predictedProofOfTask = `CancelOrder-${side}-${taskResult['order']['order_id']}-${timestampFormatted}`;

        //     if (predictedProofOfTask=== proofOfTask) {
        //         isApproved = true;
        //     }
        // } else if (taskDefinitionId === taskController.taskDefinitionId.UpdateBestPrice) {
        //     const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        //         ['tuple(uint256 orderId, address account, uint256 sqrtPrice, uint256 amount, bool isBid, address baseAsset, address quoteAsset, uint256 quoteAmount, bool isValid, uint256 timestamp)'],
        //         data
        //     );
        //     const {
        //         orderId,
        //         account,
        //         sqrtPrice,
        //         amount,
        //         isBid,  
        //         baseAsset,
        //         quoteAsset,
        //         quoteAmount,
        //         isValid,
        //         timestamp
        //     } = decodedData[0];
        //     const side = isBid ? 'bid' : 'ask';
        //     const timestampFormatted = Number(ethers.formatUnits(timestamp, taskController.decimal));
        //     const predictedProofOfTask = `UpdateBestPrice-${side}-${orderId}-${timestampFormatted}`;

        //     if (predictedProofOfTask === proofOfTask) {
        //         isApproved = true;  
        //     }
        // }

        // return isApproved;
    } catch (err) {
        console.error(err?.message);
        return false;
    }
}

async function validateWithdrawal(proofOfTask, data) {
    try {
        // Parse the withdrawal data
        const account = ethers.getAddress('0x' + Buffer.from(data.slice(0, 20)).toString('hex'));
        const asset = ethers.getAddress('0x' + Buffer.from(data.slice(20, 40)).toString('hex'));
        const amount = ethers.getBigInt('0x' + Buffer.from(data.slice(40, 72)).toString('hex'));
        
        // Extract signature from proof of task
        // Format: Withdrawal_<id>_User_<account>_Asset_<asset>_Amount_<amount>_Timestamp_<timestamp>_Signature_<signature>
        const proofParts = proofOfTask.split('_');
        const signature = proofParts[proofParts.indexOf('Signature') + 1];
        const amountStr = proofParts[proofParts.indexOf('Amount') + 1];
        
        // Verify signature
        const withdrawalMessage = `Withdraw ${amountStr} of token ${asset}`;
        const messageHash = ethers.hashMessage(withdrawalMessage);
        const recoveredAddress = ethers.recoverAddress(messageHash, signature);
        
        if (recoveredAddress.toLowerCase() !== account.toLowerCase()) {
            console.error("Signature verification failed for withdrawal");
            return false;
        }
        
        // Check if funds are available in escrow
        const avsHookAddress = process.env.AVS_HOOK_ADDRESS;
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const avsHookContract = new ethers.Contract(avsHookAddress, require('./abi/P2POrderBookABI.js'), provider);
        
        // Check on-chain escrow balance
        const escrowedBalance = await avsHookContract.escrowedFunds(account, asset);
        
        if (escrowedBalance < amount) {
            console.error("Insufficient funds in escrow for withdrawal");
            return false;
        }
        
        // Check if funds are not locked in open orders
        const formData = new FormData();
        formData.append('payload', JSON.stringify({
            account,
            asset
        }));
        
        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/check_available_funds`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            console.error("Failed to check available funds in orderbook");
            return false;
        }
        
        const fundData = await response.json();
        
        if (fundData.lockedAmount && 
            ethers.parseUnits(fundData.lockedAmount.toString(), 
                              asset === taskController.token_symbol_address_mapping['WETH'] ? 18 : 6) + amount > escrowedBalance) {
            console.error("Funds are locked in open orders");
            return false;
        }
        
        // All checks passed
        console.log(`Withdrawal validated for account ${account}, asset ${asset}, amount ${amount}`);
        return true;
    } catch (err) {
        console.error("Error validating withdrawal:", err);
        return false;
    }
}

async function validateCancelOrder(proofOfTask, data) {
    try {
        // Parse the cancel order data from the binary format
        const orderId = ethers.getBigInt('0x' + Buffer.from(data.slice(0, 32)).toString('hex'));
        const isBid = Buffer.from(data.slice(32, 64)).toString('hex') !== '0'.repeat(64); // boolean
        const baseAsset = ethers.getAddress('0x' + Buffer.from(data.slice(64, 96)).toString('hex'));
        const quoteAsset = ethers.getAddress('0x' + Buffer.from(data.slice(96, 128)).toString('hex'));
        
        // Extract information from proof of task
        // Format: CancelOrder-<side>-<orderId>-<timestamp>
        const proofParts = proofOfTask.split('-');
        const side = proofParts[1]; // 'bid' or 'ask'
        const orderIdFromProof = proofParts[2];
        const timestampFromProof = proofParts[3];
        
        // Verify that the orderId and side match
        if (orderId.toString() !== orderIdFromProof || 
            (isBid && side !== 'bid') || 
            (!isBid && side !== 'ask')) {
            console.error("Order ID or side mismatch in cancel order validation");
            return false;
        }
        
        // Convert addresses to symbols
        const baseAssetSymbol = taskController.token_address_symbol_mapping[baseAsset];
        const quoteAssetSymbol = taskController.token_address_symbol_mapping[quoteAsset];
        
        if (!baseAssetSymbol || !quoteAssetSymbol) {
            console.error("Invalid token addresses in cancel order request");
            return false;
        }
        
        // Call the orderbook service to cancel the order
        const formData = new FormData();
        formData.append('payload', JSON.stringify({
            orderId: orderId.toString(),
            side: side,
            baseAsset: baseAssetSymbol,
            quoteAsset: quoteAssetSymbol
        }));
        
        const response = await fetch(`${process.env.ORDERBOOK_SERVICE_ADDRESS}/api/cancel_order`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            console.error("Failed to cancel order in orderbook");
            return false;
        }
        
        const cancelData = await response.json();
        
        // Verify the cancellation was successful
        if (!cancelData.order || cancelData.status_code !== 1) {
            console.error("Order cancellation failed or returned invalid data");
            return false;
        }
        
        // Generate our own proof of task and compare
        const generatedProofOfTask = `CancelOrder-${side}-${cancelData.order.orderId}-${timestampFromProof}`;
        
        const result = proofOfTask === generatedProofOfTask;
        
        if (!result) {
            console.error(`Proof of task mismatch. Expected: ${proofOfTask}, Generated: ${generatedProofOfTask}`);
        }
        
        return result;
    } catch (err) {
        console.error("Error validating cancel order:", err);
        return false;
    }
}

module.exports = {
    validate,
    validateWithdrawal,
    validateCancelOrder
}