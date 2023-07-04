import express from 'express';

import MessageResponse from '../interfaces/MessageResponse';
import today from './today';

const router = express.Router();

router.get<{}, MessageResponse>('/', (req, res) => {
  res.json({
    message: 'API - 👋🌎🌍🌏',
  });
});

router.use('/today', today);

export default router;
