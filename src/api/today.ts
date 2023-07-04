import express from 'express';
import { News } from '../interfaces/News';
import { fetch_newsapi } from '../news/newsapi';

const router = express.Router();

type NewsResponse = {
  [key: string]: News[];
};

router.get<{}, NewsResponse>('/', async (req, res) => {
  const categories = await fetch_newsapi();
  res.json(categories);
});




export default router;
