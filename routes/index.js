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

/* upload a pet */
router.post('/upload', upload.single('photo'), async (req, res) => {
  const { name, breed, age } = req.body;
  if (!req.file) return res.send('No file selected');

  const key = `images/${Date.now()}_${req.file.originalname}`;


  if (!process.env.BUCKET) {
    console.log('No BUCKET set locally — skipping S3 upload.');
  } else {
    await s3.putObject({
      Bucket: process.env.BUCKET,
      Key:    key,
      Body:   req.file.buffer
    }).promise();
  }
  
  const pets = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  pets.push({ name, breed, age, imageKey: key });
  fs.writeFileSync(DATA, JSON.stringify(pets, null, 2));

  res.redirect('/');
});


module.exports = router;
