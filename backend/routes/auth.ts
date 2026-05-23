import express from 'express';
const router = express.Router();

import * as authController from '../controllers/authController';
// import { signup, login, logout, me } from '../controllers/authController.js';
import requireAuth from './../middleware/requireAuth';

router.post('/register', authController.signup);

router.post('/login', authController.login);

router.post('/logout', authController.logout);

router.get('/me' ,requireAuth, authController.me);

router.patch('/profile', requireAuth,  authController.updateProfile);

router.patch('/score', requireAuth, authController.submitScore);

export default router;