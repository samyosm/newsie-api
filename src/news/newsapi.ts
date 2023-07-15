//@ts-ignore
import NewsAPI from 'newsapi';
import { News } from '../interfaces/News';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { extract } from '@extractus/article-extractor'
import { convert } from 'html-to-text';
import { Category } from '../interfaces/Category';
import { extractFromHtml } from '@extractus/article-extractor';

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
    let categories: Category[] = [];

    for await (let collection of collections) {
      const articles = await collection.find().toArray();
      categories.push({
        name: collection.collectionName,
        news: articles as unknown as News[]
      })
    }

    return categories;
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
        console.log(`EXTRACTING(${category}): ${article.url}`);
        const res = await fetch(article.url);
        const html = await res.text();
        if (html) {
          extracted = await extractFromHtml(html);
        }
      } catch (error) {
        console.log(`ERROR(${category}): couldn't extract: ${article.url}`);
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
    return {
      name: category,
      news: articles
    } as Category;
  };

  const workers = [
    fill_db_category("technology"),
    fill_db_category("general"),
    fill_db_category("science"),
    fill_db_category("health"),
    fill_db_category("business")
  ];

  const categories = await Promise.all(workers);

  await client.close();

  return categories;
};
