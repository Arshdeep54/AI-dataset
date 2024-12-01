const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const csv = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const jwt = require('jsonwebtoken');

// Load artifacts from JSON file
const artifactsPath = path.join(__dirname, '..', 'artifacts.json');
let artifactsList = [];
const TOTAL_ARTIFACTS = 70;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Initialize artifacts with IDs
const initializeArtifacts = async () => {
    try {
        const artifactsData = await fs.readFile(artifactsPath, 'utf8');
        const artifacts = JSON.parse(artifactsData);
        const entries = Object.entries(artifacts);
        
        if (entries.length > TOTAL_ARTIFACTS) {
            entries.length = TOTAL_ARTIFACTS;
        } else if (entries.length < TOTAL_ARTIFACTS) {
            console.error(`Error: Not enough artifacts. Found ${entries.length}, need ${TOTAL_ARTIFACTS}`);
            process.exit(1);
        }

        artifactsList = entries.map(([name, description], index) => ({
            id: index + 1,
            name,
            description
        }));
        
        await initializeCSV();
    } catch (error) {
        console.error('Error loading artifacts:', error);
        process.exit(1);
    }
};

// Initialize CSV file with header
const initializeCSV = async () => {
    try {
        const csvPath = path.join(__dirname, '..', 'data','survey_results.csv');
        const fileExists = await fs.access(csvPath).then(() => true).catch(() => false);
        
        if (!fileExists) {
            const header = ['imagename', ...Array.from({length: TOTAL_ARTIFACTS}, (_, i) => `artifact_${i + 1}`)];
            const csvContent = stringify([header]);
            await fs.writeFile(csvPath, csvContent);
        }
    } catch (error) {
        console.error('Error initializing CSV:', error);
    }
};

// Get random artifacts
const getRandomArtifacts = (count) => {
    const shuffled = [...artifactsList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

// Read current CSV data
const readCSVData = async () => {
    try {
        const csvPath = path.join(__dirname, '..', 'data','survey_results.csv');
        const fileContent = await fs.readFile(csvPath, 'utf8');
        return csv.parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });
    } catch (error) {
        console.error('Error reading CSV:', error);
        return [];
    }
};

// Write CSV data
const writeCSVData = async (data) => {
    const csvPath = path.join(__dirname, '..', 'data','survey_results.csv');
    const header = ['imagename', ...Array.from({length: TOTAL_ARTIFACTS}, (_, i) => `artifact_${i + 1}`)];
    const csvContent = stringify([header, ...data.map(row => {
        const rowData = [row.imagename];
        for (let i = 1; i <= TOTAL_ARTIFACTS; i++) {
            rowData.push(row[`artifact_${i}`] || '0');
        }
        return rowData;
    })]);
    await fs.writeFile(csvPath, csvContent);
};

// Route to get a random image and artifacts
router.get('/random-image', authenticateToken, async (req, res) => {
    try {
        const imagesDir = path.join(__dirname, '..', 'images');
        const files = await fs.readdir(imagesDir);
        const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png)$/i.test(file)
        );

        if (imageFiles.length === 0) {
            return res.status(404).json({ error: 'No images available' });
        }

        // Get random image
        const randomIndex = Math.floor(Math.random() * imageFiles.length);
        const randomImage = imageFiles[randomIndex];

        // Get 10 random artifacts
        const randomArtifacts = getRandomArtifacts(10);

        res.json({
            imageUrl: `http://localhost:5000/images/${randomImage}`,
            filename: randomImage,
            artifacts: randomArtifacts
        });
    } catch (error) {
        console.error('Error getting random image:', error);
        res.status(500).json({ error: 'Failed to get random image' });
    }
});

// Route to submit survey responses
router.post('/submit', authenticateToken, async (req, res) => {
    const { filename, responses } = req.body;
    const userId = req.user.enrollmentNumber;
    
    if (!filename || !responses) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
       

        // Read current CSV data
        const csvData = await readCSVData();
        
        // Find or create row for this image
        let imageRow = csvData.find(row => row.imagename === filename);
        if (!imageRow) {
            imageRow = {
                imagename: filename,
                ...Object.fromEntries(artifactsList.map(a => [`artifact_${a.id}`, '0']))
            };
            csvData.push(imageRow);
        }

        // Update counts for each response
        Object.entries(responses).forEach(([artifactId, response]) => {
            const columnName = `artifact_${artifactId}`;
            const currentValue = parseInt(imageRow[columnName]) || 0;
            
            console.log('Response received:', response, 'type:', typeof response);
            console.log('Current value:', currentValue);
            
            // Convert boolean response to yes/no string if needed
            const responseStr = typeof response === 'boolean' ? (response ? 'yes' : 'no') : response;
            
            if (responseStr === 'yes' || responseStr === true) {
                imageRow[columnName] = (currentValue + 1).toString();
            } else if (responseStr === 'no' || responseStr === false) {
                imageRow[columnName] = (currentValue - 1).toString();
            } else {
                imageRow[columnName] = '0';
            }
            
            console.log('New value:', imageRow[columnName]);
        });

        // Write updated data back to CSV
        await writeCSVData(csvData);

                
        res.json({ 
            success: true,
            message: 'Responses recorded successfully',
        });
    } catch (error) {
        console.error('Error submitting responses:', error);
        res.status(500).json({ error: 'Failed to submit responses' });
    }
});


// Initialize artifacts on startup
initializeArtifacts();

module.exports = router;
