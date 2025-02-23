-include .env

START_LOG = @echo "=============== START OF LOG ==============="
END_LOG = @echo "================ END OF LOG ================"

.PHONY: step0_localUniswapV4
step0_localUniswapV4:
	$(START_LOG)
	@forge script ./script/DeployLocalUniswapV4.s.sol --broadcast \
		--rpc-url $(L2_RPC) \
		--private-key $(PRIVATE_KEY) \
		-v \
		--sig "run(address)" $(OWNER_ADDRESS)
	$(END_LOG)

.PHONY: step1_avsHook
step1_avsHook:
	$(START_LOG)
	@forge script ./script/DeployAvsHook.s.sol --broadcast \
		--rpc-url $(L2_RPC) \
		--private-key $(PRIVATE_KEY) \
		-v \
		--sig "run(address,address)" $(ATTESTATION_CENTER_ADDRESS) $(POOL_MANAGER_ADDRESS)
	$(END_LOG)

.PHONY: step2_token
step2_token:
	$(START_LOG)
	@forge script ./script/DeployToken.s.sol --broadcast \
		--rpc-url $(L2_RPC) \
		--private-key $(PRIVATE_KEY) \
		-vvv \
		--sig "run(address,address)" $(POOL_MANAGER_ADDRESS) $(AVS_HOOK_ADDRESS)
	$(END_LOG)
