const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const csv = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// Load artifacts from JSON file
const artifactsPath = path.join(__dirname, '..', 'artifacts.json');
let artifactsList = [];
const TOTAL_ARTIFACTS = 70; // Set constant for total artifacts

// Database setup
let db;
const initializeDatabase = async () => {
    try {
        db = await open({
            filename: path.join(__dirname, '..', 'survey.db'),
            driver: sqlite3.Database
        });

        // Create user_progress table if it doesn't exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS user_progress (
                user_id TEXT,
                image_name TEXT,
                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, image_name)
            )
        `);

        // Create user_stats table if it doesn't exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id TEXT PRIMARY KEY,
                images_analyzed INTEGER DEFAULT 0
            )
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
};

// Initialize database on startup
initializeDatabase();

// Get user's viewed images
const getUserViewedImages = async (userId) => {
    try {
        const rows = await db.all(
            'SELECT image_name FROM user_progress WHERE user_id = ?',
            userId
        );
        return new Set(rows.map(row => row.image_name));
    } catch (error) {
        console.error('Error getting user viewed images:', error);
        return new Set();
    }
};

// Add image to user's history
const addImageToUserHistory = async (userId, imageName) => {
    try {
        await db.run(
            'INSERT INTO user_progress (user_id, image_name) VALUES (?, ?)',
            userId,
            imageName
        );
    } catch (error) {
        console.error('Error adding image to user history:', error);
    }
};

// Clear user's history
const clearUserHistory = async (userId) => {
    try {
        await db.run('DELETE FROM user_progress WHERE user_id = ?', userId);
    } catch (error) {
        console.error('Error clearing user history:', error);
    }
};

// Get user's stats
const getUserStats = async (userId) => {
    try {
        const stats = await db.get(
            'SELECT images_analyzed FROM user_stats WHERE user_id = ?',
            userId
        );
        return stats ? stats.images_analyzed : 0;
    } catch (error) {
        console.error('Error getting user stats:', error);
        return 0;
    }
};

// Increment user's analyzed images count
const incrementUserAnalyzedCount = async (userId) => {
    try {
        await db.run(`
            INSERT INTO user_stats (user_id, images_analyzed)
            VALUES (?, 1)
            ON CONFLICT(user_id) DO UPDATE SET
            images_analyzed = images_analyzed + 1
        `, userId);
    } catch (error) {
        console.error('Error incrementing user analyzed count:', error);
    }
};

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

router.get('/random-image', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.enrollmentNumber;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Get user's analyzed count
        const imagesAnalyzed = await getUserStats(userId);

        const imagesDir = path.join(__dirname, '..', 'images');
        const files = await fs.readdir(imagesDir);
        const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png)$/i.test(file)
        );

        if (imageFiles.length === 0) {
            return res.status(404).json({ error: 'No images available' });
        }

        // Get user's image history from database
        const userHistory = await getUserViewedImages(userId);
        
        // Filter out images the user has already seen
        const unseenImages = imageFiles.filter(file => !userHistory.has(file));

        // If user has seen all images, clear their history and start over
        if (unseenImages.length === 0) {
            await clearUserHistory(userId);
            return res.status(200).json({ 
                message: 'You have seen all available images. Starting over.',
                completed: true,
                imagesAnalyzed 
            });
        }

        // Get random unseen image
        const randomIndex = Math.floor(Math.random() * unseenImages.length);
        const randomImage = unseenImages[randomIndex];

        // Add image to user's history in database
        await addImageToUserHistory(userId, randomImage);

        // Get 10 random artifacts
        const randomArtifacts = getRandomArtifacts(10);

        // Return image URL, filename, artifacts, and stats
        res.json({
            imageUrl: `http://localhost:5000/images/${randomImage}`,
            filename: randomImage,
            artifacts: randomArtifacts,
            remainingImages: unseenImages.length - 1,
            imagesAnalyzed
        });
    } catch (error) {
        console.error('Error getting random image:', error);
        res.status(500).json({ error: 'Failed to get random image' });
    }
});

router.post('/submit', authenticateToken, async (req, res) => {
    const { filename, responses } = req.body;
    const userId = req.user.enrollmentNumber;
    
    if (!filename || !responses) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Increment user's analyzed count
        await incrementUserAnalyzedCount(userId);

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

        // Get updated stats
        const imagesAnalyzed = await getUserStats(userId);
        
        res.json({ 
            success: true,
            message: 'Responses recorded successfully',
            imagesAnalyzed
        });
    } catch (error) {
        console.error('Error submitting responses:', error);
        res.status(500).json({ error: 'Failed to submit responses' });
    }
});

// Initialize artifacts when server starts
initializeArtifacts();

module.exports = router;
