import { GoogleGenerativeAI } from "@google/generative-ai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import "dotenv/config";
import sampleData from "./data.json" with { type: "json" };

//  Google Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

// Astra DB setup
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
  keyspace: process.env.ASTRA_DB_NAMESPACE,
});

// Text splitter config
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Step 1️: Drop and recreate collection
const recreateCollection = async () => {
  try {
    console.log("🗑 Dropping old collection (if exists)...");
    await db.dropCollection("portfolio");
    console.log("✅ Old collection dropped");
  } catch (error) {
    console.warn("⚠️ No existing collection found, continuing...");
  }

  try {
    console.log("📦 Creating new collection with correct dimension...");
    await db.createCollection("portfolio", {
      vector: { dimension: 768 }, 
    });
    console.log("✅ New collection created successfully");
  } catch (error) {
    console.error("🚨 Error creating collection:", error.message);
    throw error;
  }
};

// Step 2️: Embed and insert documents
const loadData = async () => {
  const collection = db.collection("portfolio");

  for await (const { id, info, description } of sampleData) {
    const chunks = await splitter.splitText(description);
    let chunkCount = 0;

    for await (const chunk of chunks) {
      let vector = Array(768).fill(0); 

      try {
        const result = await embeddingModel.embedContent(chunk);
        vector = result.embedding.values; 
        if (!Array.isArray(vector) || vector.length !== 768) {
          throw new Error(`Invalid embedding size: ${vector.length}`);
        }
      } catch (error) {
        console.error(`🚫 Embedding error at ID ${id}, chunk ${chunkCount}: ${error.message}`);
      }

      try {
        await collection.insertOne({
          document_id: id,
          $vector: vector,
          info,
          description: chunk,
        });
      } catch (error) {
        console.error(`❌ Insertion failed for ID ${id}, chunk ${chunkCount}: ${error.message}`);
      }

      chunkCount++;
    }

    console.log(`Data inserted for ID ${id}`);
  }ings

  console.log(" All data embedded and stored successfully");
};

// Run scripts db Embedd
(async () => {
  try {
    await recreateCollection();
    await loadData();
  } catch (err) {
    console.error("💥 Fatal error in setup:", err.message);
  }
})();
