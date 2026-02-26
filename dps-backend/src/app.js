import express from "express";
import cors from "cors";


const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("src/uploads"));

export default app;
