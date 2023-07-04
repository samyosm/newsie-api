//@ts-ignore
import NewsAPI from 'newsapi';
import { News } from '../interfaces/News';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { extract } from '@extractus/article-extractor'
import { convert } from 'html-to-text';

require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI as string, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const today = new Date();
const date = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth()).padStart(2, '0')}-${today.getFullYear()}`
const db = client.db(date);

export const fetch_newsapi = async () => {
  await client.connect();
  const stats = await db.stats();
  if (stats.collections > 0) {
    console.log("FROM CACHE");
    const collections = await db.collections();
    let result: { [key: string]: News[] } = {};

    for await (let collection of collections) {
      const articles = await collection.find().toArray();
      result[collection.collectionName] = articles as unknown as News[];
    }

    return result;
  }

  console.log("FROM API");
  const newsapi = new NewsAPI(process.env.NEWSAPI_KEY);

  const fetch_category = async (category: string) => {
    const news = await newsapi.v2.topHeadlines({
      category,
      country: 'us',
      pageSize: 100,
    });

    const articles = await Promise.all(news.articles.map(async (article: any) => {
      let extracted = null;

      try {
        console.info(`EXTRACTING(${category}): ${article.url}`);
        extracted = await extract(article.url as string);
      } catch (error) {
        console.error(`ERROR: couldn't extract: ${article.url}`);
      }

      return {
        source: article.source.name || extracted?.source,
        author: article.author || extracted?.author,
        url: article.url,
        title: article.title || extracted?.title,
        preview: article.description || extracted?.description,
        content: convert(extracted?.content || "none")
      }
    })) as News[];

    return articles;
  }

  const fill_db_category = async (category: string) => {
    const articles = await fetch_category(category);
    await db.collection(category).insertMany(articles);
    let result: { [key: string]: News[] } = {};
    result[category] = articles;
    return result;
  };

  const workers = [
    fill_db_category("technology"),
    fill_db_category("general"),
    fill_db_category("science"),
    // fill_db_category("health"),
    fill_db_category("business")
  ];

  const categories = await Promise.all(workers);
  const result = categories.reduce((result, category) => ({ ...category, ...result }))

  await client.close();

  return result;
};
