"use strict";
const { Router } = require("express")
const CustomError = require("./utils/validateError");
const CustomResponse = require("./utils/validateResponse");
const validatorService = require("./validator.service");

const router = Router()

router.post("/validate", async (req, res) => {
    const proofOfTask = req.body.proofOfTask;
    const data = req.body.data;
    const taskDefinitionId = req.body.taskDefinitionId;

    console.log(`Validate task: proof of task: ${proofOfTask}`);

    try {
        const result = await validatorService.validate(proofOfTask, data, taskDefinitionId);
        console.log('Vote:', result ? 'Approve' : 'Not Approved');
        return res.status(200).send(new CustomResponse(result));
    } catch (error) {
        console.log(error)
        return res.status(500).send(new CustomError("Something went wrong", {}));
    }
})

module.exports = router
