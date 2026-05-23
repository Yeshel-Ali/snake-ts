import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

const clientUrls = (process.env.CLIENT_URL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: clientUrls,
        credentials: true,
    }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

export default app;