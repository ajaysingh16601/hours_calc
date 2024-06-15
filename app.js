import express from 'express';
import bodyParser from 'body-parser';
import { scrapeData } from './scrape.js';

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/scrape', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await scrapeData(email, password);
        res.json({ result });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
