const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const crypto = require('crypto');

const UsersController = {
  async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const userExists = await dbClient.db.collection('users').findOne({ email });
      if (userExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

      const newUser = {
	email,
	password: hashedPassword
      };

      const result = await dbClient.db.collection('users').insertOne(newUser);

      return res.status(201).json({ email: newUser.email, id: result.insertedId });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

module.exports = UsersController;
