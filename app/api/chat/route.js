import { GoogleGenerativeAI } from "@google/generative-ai";
import { DataAPIClient } from "@datastax/astra-db-ts";

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages.at(-1)?.content ?? "";

    // ✅ Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ✅ Generate embedding
    const embedResult = await embedModel.embedContent(latestMessage);
    const userEmbedding = embedResult.embedding.values;

    // ✅ Astra DB
    const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
    const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
      keyspace: process.env.ASTRA_DB_NAMESPACE,
    });
    const collection = db.collection("portfolio");

    // ✅ Vector Search
    const cursor = collection.find(null, {
      sort: { $vector: userEmbedding },
      limit: 5,
    });
    const documents = await cursor.toArray();

    const docContext =
      documents.length > 0
        ? `START CONTEXT\n${documents
            .map((doc) => `• ${doc.info}: ${doc.description}`)
            .join("\n")}\nEND CONTEXT`
        : "(No relevant vector data found)";

    const systemPrompt = `
      You are an AI assistant answering as Karthick RamAlagar in his AI Portfolio App.
      Use the following context to answer:
      ${docContext}
      If the answer is not in the context, respond:
      "There is no vector data available to answer your question."
      Format responses in markdown.
    `;

    const fullPrompt = `${systemPrompt}\n\nUser Question:\n${latestMessage}`;

    try {
      // ✅ Primary LLM
      const result = await chatModel.generateContent(fullPrompt);
      const responseText = result.response.text();

      return new Response(JSON.stringify({ output: responseText }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Gemini API Error:", error);

      // ✅ Static fallback if quota exceeded
      if (
        error.status === 429 ||
        error.message.includes("429") ||
        error.toString().includes("Too Many Requests")
      ) {
        return new Response(
          JSON.stringify({
            output:
              "⚠️ Your AI quota is finished for today. Please try again tomorrow.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ✅ Other errors
      return new Response(
        JSON.stringify({
          output: "⚠️ Unable to process your request. Please try again later.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("❌ Chat API error:", error);
    return new Response(
      JSON.stringify({ output: "Server error. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
