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
		--verify \
		--etherscan-api-key $(L2_ETHERSCAN_API_KEY) \
		--delay 60 \
		-v \
		--sig "run(address,address)" $(ATTESTATION_CENTER_ADDRESS) $(POOL_MANAGER_ADDRESS) | tee deploy_log.txt; \
	grep "Deployed P2POrderBookAvsHook at:" deploy_log.txt | awk '{print "AVS_HOOK_ADDRESS=" $$4}' >> .env; \
	rm deploy_log.txt;
	$(END_LOG)

.PHONY: step2_token
step2_token:
	$(START_LOG)
	@forge script ./script/DeployToken.s.sol --broadcast \
		--rpc-url $(L2_RPC) \
		--private-key $(PRIVATE_KEY) \
		-v \
		--sig "run(address,address)" $(POOL_MANAGER_ADDRESS) $(AVS_HOOK_ADDRESS)
	$(END_LOG)

.PHONY: step3_transferTokenToTestUser
step3_transferTokenToTestUser:
	$(START_LOG)
	@forge script ./script/DeployTransferTokenToTestUser.s.sol --broadcast \
		--rpc-url $(L2_RPC) \
		--private-key $(PRIVATE_KEY) \
		-v \
		--sig "run(address,address,address,address)" $(TOKENA_ADDRESS) $(TOKENB_ADDRESS) $(USER1_ADDRESS) $(USER2_ADDRESS)
	$(END_LOG)

.PHONY: step4_testUser1
step4_testUser1:
	$(START_LOG)
	@forge script ./script/DeployTestUser1.s.sol --broadcast \
		--rpc-url $(L2_RPC) \
		--private-key $(USER1_PRIVATE_KEY) \
		-v \
		--sig "run(address,address,address)" $(TOKENA_ADDRESS) $(TOKENB_ADDRESS) $(AVS_HOOK_ADDRESS)
	$(END_LOG)

.PHONY: step5_testUser2
step5_testUser2:
	$(START_LOG)
	@forge script ./script/DeployTestUser2.s.sol --broadcast \
		--rpc-url $(L2_RPC) \
		--private-key $(USER2_PRIVATE_KEY) \
		-v \
		--sig "run(address,address,address)" $(TOKENA_ADDRESS) $(TOKENB_ADDRESS) $(AVS_HOOK_ADDRESS)
	$(END_LOG)
