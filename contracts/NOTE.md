forge script script/DynamicFeesAvsHook.s.sol:DynamicFeesAvsHookDeploy \
    --rpc-url $L2_RPC \
    --private-key $PRIVATE_KEY \
    --broadcast -vvvv \
    --chain $L2_CHAIN \
    --sig="run(address,address)" $ATTESTATION_CENTER_ADDRESS $POOL_MANAGER_ADDRESS


## Create new task

```
$ othentic-cli network create-task --l1-chain holesky --l2-chain amoy
```