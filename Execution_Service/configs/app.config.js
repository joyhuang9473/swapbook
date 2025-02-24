"use strict";
const env = require("dotenv")
env.config()
const express = require("express")
const app = express()
const cors = require('cors')
const routes = require("../src/routes")

app.use(express.json())
app.use(cors())
app.use("/api", routes)

module.exports = app