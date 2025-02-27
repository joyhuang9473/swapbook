"use strict";
const { Router } = require("express")
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");
const validatorService = require("./validator.service");

const router = Router()

router.post("/validate", async (req, res) => {
    try {
        const { proofOfTask, data, taskDefinitionId } = req.body;

        if (!proofOfTask || !data || !taskDefinitionId) {
            return res.status(400).send(new CustomError("Missing required fields: proofOfTask, data, taskDefinitionId", {}));
        }

        const isApproved = await validatorService.validate(proofOfTask, data, taskDefinitionId);

        return res.status(isApproved ? 200 : 400).send(
            isApproved 
            ? new CustomResponse({ proofOfTask, taskDefinitionId, isApproved }) 
            : new CustomError("Validation failed", { proofOfTask, taskDefinitionId })
        );
    } catch (error) {
        return res.status(500).send(new CustomError(error.message || "Error in validation", error.data || {}));
    }
})

module.exports = router
