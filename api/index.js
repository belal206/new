const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5070;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/poetry-royal';
const clientDistPath = path.resolve(__dirname, '../client/dist');

const normalizeTags = (tags) => [...new Set(
    (Array.isArray(tags) ? tags : [])
        .map((tag) => String(tag).trim())
        .filter(Boolean)
)].slice(0, 6);

mongoose.connect(MONGO_URI)
    .then(() => console.log('🏛️ Shahi Darbar Connected (MongoDB)'))
    .catch(err => console.error('Error connecting to Shahi Darbar:', err));

const Poem = mongoose.model('Poem', new mongoose.Schema({
    title: { type: String, required: true },
    poet: { type: String, required: true },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
}));

app.get('/api/poems', async (req, res) => {
    try {
        const poems = await Poem.find().sort({ createdAt: -1 });
        res.json(poems);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch' });
    }
});

app.post('/api/poems', async (req, res) => {
    try {
        const payload = {
            ...req.body,
            tags: normalizeTags(req.body.tags)
        };
        const newPoem = new Poem(payload);
        await newPoem.save();
        res.status(201).json(newPoem);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save' });
    }
});

app.put('/api/poems/:id', async (req, res) => {
    try {
        const payload = {
            title: req.body.title,
            poet: req.body.poet,
            content: req.body.content,
            tags: normalizeTags(req.body.tags)
        };
        const updatedPoem = await Poem.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );
        if (!updatedPoem) {
            return res.status(404).json({ error: 'Poem not found' });
        }
        res.json(updatedPoem);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

app.delete('/api/poems/:id', async (req, res) => {
    try {
        await Poem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

app.get('/api/seed', async (req, res) => {
    const seeds = [
        { title: "Ranjish Hi Sahi", poet: "Ahmad Faraz", content: "Ranjish hi sahi dil hi dukhane ke liye aa...\nAa phir se mujhe chhod ke jaane ke liye aa.", tags: ["Longing", "Heartbreak"] },
        { title: "Suna Hai Log", poet: "Ahmad Faraz", content: "Suna hai log usay aankh bhar ke dekhte hain\nSo us ke sheher mein kuchh din theher ke dekhte hain.", tags: ["Romantic", "Nostalgic"] },
        { title: "Hazaron Khwahishen", poet: "Mirza Ghalib", content: "Hazaron khwahishen aisi ke har khwahish pe dam nikle\nBohat niklay mere armaan lekin phir bhi kam nikle", tags: ["Melancholic", "Longing"] }
    ];
    await Poem.insertMany(seeds);
    res.send('Royal seeds planted.');
});

app.get('/healthz', (req, res) => {
    res.json({ ok: true });
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(clientDistPath));

    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

app.listen(PORT, () => console.log(`Royal API on ${PORT}`));
