"use strict";
const app = require("./configs/app.config")
const PORT = process.env.port || process.env.PORT || 4003
const dalService = require("./src/dal.service");
// const taskPerformer = require("./src/task.controller");
dalService.init();
// taskPerformer.start()

// app.get('/health', (req, res) => res.send('OK'));
app.listen(PORT, '0.0.0.0', () => console.log("Server started on port:", PORT))