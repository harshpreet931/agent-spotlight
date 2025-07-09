import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { query, tools, history, apiKey } = await req.json();

    const key = apiKey || process.env.GOOGLE_API_KEY || "";
    if (!key) {
      return NextResponse.json({ error: "API key is missing" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const chat = model.startChat({
      tools: tools || [],
      history: history || [],
    });

    const result = await chat.sendMessage(query);
    const response = await result.response;
    const functionCalls = response.functionCalls();
    const text = response.text();

    if (functionCalls && functionCalls.length > 0) {
      return NextResponse.json({
        type: "tool_call",
        tool_calls: functionCalls,
      });
    }

    return NextResponse.json({ type: "text", response: text });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
