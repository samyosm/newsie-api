import express from 'express';
import { fetch_newsapi } from '../news/newsapi';
import { Category } from '../interfaces/Category';

const router = express.Router();

type NewsResponse = Category[];

router.get<{}, NewsResponse>('/', async (req, res) => {
  const categories = await fetch_newsapi();
  res.json(categories);
});




export default router;
