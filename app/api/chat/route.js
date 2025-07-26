import { GoogleGenerativeAI } from "@google/generative-ai";
import { DataAPIClient } from "@datastax/astra-db-ts";

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages.at(-1)?.content ?? "";

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Generate embedding for the user query
    const embedResult = await embedModel.embedContent(latestMessage);
    const userEmbedding = embedResult.embedding.values; // should be length 768

    // Connect to Astra DB
    const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
    const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
      keyspace: process.env.ASTRA_DB_NAMESPACE,
    });
    const collection = db.collection("portfolio");

    //  Perform vector search for relevant context
    const cursor = collection.find(null, {
      sort: { $vector: userEmbedding },
      limit: 5,
    });

    const documents = await cursor.toArray();
    const docContext = `
      START CONTEXT
      ${documents.map((doc) => `• ${doc.info}: ${doc.description}`).join("\n")}
      END CONTEXT
      `;

    //  Build system + user prompt
    const systemPrompt = `
      You are an AI assistant answering questions as Karthick RamAlagar in his AI Portfolio App.
      Use the following context to answer:
      ${docContext}
      If the answer is not in the context, respond with:
      "There is no vector data available to answer your question."
      Format responses using markdown for readability.
      `;

    const fullPrompt = `
    ${systemPrompt}

    User Question:
    ${latestMessage}
    `;

    // Generate response from Gemini
    const result = await chatModel.generateContent(fullPrompt);
    const responseText = result.response.text();

    return new Response(JSON.stringify({ output: responseText }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
