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
const TOTAL_ARTIFACTS = 70; // Set constant for total artifacts

// In-memory store for user-image mappings
const userImageHistory = new Map();

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
        
        // Ensure we only use exactly 70 artifacts
        if (entries.length > TOTAL_ARTIFACTS) {
            console.warn(`Warning: Found ${entries.length} artifacts, using only first ${TOTAL_ARTIFACTS}`);
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
        
        console.log(`Loaded ${artifactsList.length} artifacts`);
        await initializeCSV();
    } catch (error) {
        console.error('Error loading artifacts:', error);
        process.exit(1);
    }
};

// Initialize CSV file with header and zeros
const initializeCSV = async () => {
    try {
        const csvPath = path.join(__dirname, '..', 'survey_results.csv');
        const fileExists = await fs.access(csvPath).then(() => true).catch(() => false);
        
        if (!fileExists) {
            // Create header with imagename and exactly 70 artifact columns
            const header = ['imagename', ...Array.from({length: TOTAL_ARTIFACTS}, (_, i) => `artifact_${i + 1}`)];
            const csvContent = stringify([header]);
            await fs.writeFile(csvPath, csvContent);
            console.log('Created new CSV file with 70 artifact columns');
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
    const csvPath = path.join(__dirname, '..', 'survey_results.csv');
    try {
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
    const csvPath = path.join(__dirname, '..', 'survey_results.csv');
    const header = ['imagename', ...Array.from({length: TOTAL_ARTIFACTS}, (_, i) => `artifact_${i + 1}`)];
    const csvContent = stringify([header, ...data.map(row => {
        const rowData = [row.imagename];
        // Ensure exactly 70 columns
        for (let i = 1; i <= TOTAL_ARTIFACTS; i++) {
            rowData.push(row[`artifact_${i}`] || '0');
        }
        return rowData;
    })]);
    await fs.writeFile(csvPath, csvContent);
};

// Apply authentication middleware to routes
router.get('/random-image', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.enrollmentNumber;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const imagesDir = path.join(__dirname, '..', 'images');
        const files = await fs.readdir(imagesDir);
        const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png)$/i.test(file)
        );

        if (imageFiles.length === 0) {
            return res.status(404).json({ error: 'No images available' });
        }

        // Get user's image history
        const userHistory = userImageHistory.get(userId) || new Set();
        
        // Filter out images the user has already seen
        const unseenImages = imageFiles.filter(file => !userHistory.has(file));

        // If user has seen all images, clear their history and start over
        if (unseenImages.length === 0) {
            userImageHistory.set(userId, new Set());
            return res.status(200).json({ 
                message: 'You have seen all available images. Starting over.',
                completed: true 
            });
        }

        // Get random unseen image
        const randomIndex = Math.floor(Math.random() * unseenImages.length);
        const randomImage = unseenImages[randomIndex];

        // Add image to user's history
        userHistory.add(randomImage);
        userImageHistory.set(userId, userHistory);

        // Get 10 random artifacts
        const randomArtifacts = getRandomArtifacts(10);

        // Return image URL, filename, and artifacts
        res.json({
            imageUrl: `http://localhost:5000/images/${randomImage}`,
            filename: randomImage,
            artifacts: randomArtifacts,
            remainingImages: unseenImages.length - 1
        });
    } catch (error) {
        console.error('Error getting random image:', error);
        res.status(500).json({ error: 'Failed to get random image' });
    }
});

router.post('/submit', authenticateToken, async (req, res) => {
    const { filename, responses } = req.body;
    
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
            if (response === true) {
                imageRow[columnName] = (parseInt(imageRow[columnName] || '0') + 1).toString();
            }
        });

        // Write updated data back to CSV
        await writeCSVData(csvData);

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving survey response:', error);
        res.status(500).json({ error: 'Failed to save response' });
    }
});

// Initialize artifacts when server starts
initializeArtifacts();

module.exports = router;
