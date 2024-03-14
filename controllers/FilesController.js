const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { ObjectId } = require('mongodb');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

const FilesController = {
  async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = '0', isPublic = false, data } = req.body;

    // Check required fields
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing or invalid type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    try {
      // Check if the user exists based on the token
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check parentId validity
      if (parentId !== '0') {
        const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      let localPath;
      if (type !== 'folder') {
        // Ensure folder exists
        fs.mkdirSync(FOLDER_PATH, { recursive: true });

        // Create local path
        localPath = path.join(FOLDER_PATH, `${uuidv4()}`);
        // Decode and save file
        const decodedData = Buffer.from(data, 'base64');
        fs.writeFileSync(localPath, decodedData);
      }

      const parentIdObj = parentId !== '0' ? ObjectId(parentId) : null;

      // Create file document
      const newFile = {
	userId: ObjectId(userId),
	name,
	type,
	isPublic,
	parentId: parentIdObj,
	localPath: type !== 'folder' ? localPath : null
      };
	// Save file document to database
      const result = await dbClient.db.collection('files').insertOne(newFile);

      return res.status(201).json({ ...newFile, _id: result.insertedId });
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

module.exports = FilesController;
