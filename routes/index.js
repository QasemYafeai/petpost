const express = require('express');
const router  = express.Router();

require('dotenv').config();
const AWS = require('aws-sdk');
const s3  = new AWS.S3({ region: process.env.AWS_REGION });

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer();

const DATA = path.join(__dirname, '..', 'pet-data.json');

/* list pets */
router.get('/', (_req, res) => {
  let pets = [];
  try {
    const raw = fs.readFileSync(DATA, 'utf8') || '[]';
    pets = JSON.parse(raw);
    if (!Array.isArray(pets)) pets = [];   
  } catch {
    pets = [];                             
  }

  const signed = pets.map(p => ({
    ...p,
    url: s3.getSignedUrl('getObject', {
      Bucket: process.env.BUCKET,
      Key: p.imageKey,
      Expires: 3600
    })
  }));
  res.render('index', { title: 'PetPost', pets: signed });
});
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const { name, breed, age } = req.body;
    if (!req.file) return res.status(400).send('No file');

    const key = `images/${Date.now()}_${req.file.originalname}`;

    // Skip S3 when BUCKET isn’t set (local dev)
    if (process.env.BUCKET) {
      await s3.putObject({
        Bucket: process.env.BUCKET,
        Key:    key,
        Body:   req.file.buffer,
      }).promise();
    }

    let pets = [];
    try {
      const raw = fs.readFileSync(DATA, 'utf8') || '[]';
      pets = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch { /* leave pets = [] */ }

    pets.push({ name, breed, age, imageKey: key });
    fs.writeFileSync(DATA, JSON.stringify(pets, null, 2));

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed');
  }
});



module.exports = router;
